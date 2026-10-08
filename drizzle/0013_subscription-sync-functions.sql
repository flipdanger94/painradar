CREATE SEQUENCE billing_sync_generation;
--> statement-breakpoint
INSERT INTO billing_observation(id) VALUES('subscriptions') ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO subscription_history(user_id,event_type,subscription_id,plan,status,cancel_at_period_end,applied,transition,was_paid,is_paid)
SELECT user_id,'baseline',subscription_id,plan,status,cancel_at_period_end,true,'baseline',false,status='active' AND plan IN ('pro','founder','agency') FROM subscriptions;
--> statement-breakpoint
CREATE FUNCTION begin_subscription_sync(target_user text,target_event text)
RETURNS TABLE(generation bigint,current_subscription_id text) LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM users WHERE id=target_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subscription user is missing'; END IF;
 IF EXISTS(SELECT 1 FROM webhook_events WHERE id=target_event) THEN RETURN; END IF;
 INSERT INTO subscriptions(user_id) VALUES(target_user) ON CONFLICT(user_id) DO NOTHING;
 RETURN QUERY UPDATE subscriptions SET sync_generation=nextval('billing_sync_generation') WHERE user_id=target_user RETURNING sync_generation,subscription_id;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION apply_subscription_sync(target_user text,target_event text,event_type text,event_created timestamptz,owner_generation bigint,snapshot jsonb,existing_created timestamptz DEFAULT NULL,existing_status text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE current_sub subscriptions; accepted boolean; reason text; previous_paid boolean; next_paid boolean; inserted_event text; incoming_created timestamptz;
BEGIN
 PERFORM 1 FROM users WHERE id=target_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subscription user is missing'; END IF;
 SELECT * INTO current_sub FROM subscriptions WHERE user_id=target_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subscription synchronization was not started'; END IF;
 IF EXISTS(SELECT 1 FROM webhook_events WHERE id=target_event) THEN RETURN 'duplicate'; END IF;
 IF current_sub.sync_generation<>owner_generation THEN RETURN 'superseded'; END IF;
 INSERT INTO webhook_events(id) VALUES(target_event) ON CONFLICT DO NOTHING RETURNING id INTO inserted_event;
 IF inserted_event IS NULL THEN RETURN 'duplicate'; END IF;
 incoming_created=(snapshot->>'createdAt')::timestamptz;
 accepted=true; reason='updated';
 IF accepted AND current_sub.subscription_id IS NOT NULL AND current_sub.subscription_id<>snapshot->>'id' THEN
  accepted=incoming_created>coalesce(current_sub.provider_created_at,existing_created)
   OR (incoming_created=coalesce(current_sub.provider_created_at,existing_created)
    AND existing_status IN ('canceled','incomplete_expired') AND snapshot->>'status' NOT IN ('canceled','incomplete_expired'));
  accepted=coalesce(accepted,false) AND (snapshot->>'status' IN ('active','trialing') OR coalesce(existing_status,current_sub.status) NOT IN ('active','trialing'));
  IF NOT accepted THEN reason='older_or_ambiguous_subscription'; END IF;
 END IF;
 previous_paid=current_sub.status='active' AND current_sub.plan IN ('pro','founder','agency');
 next_paid=snapshot->>'status'='active' AND snapshot->>'plan' IN ('pro','founder','agency');
 IF accepted THEN
  reason=CASE WHEN NOT previous_paid AND next_paid THEN 'started'
   WHEN previous_paid AND NOT next_paid THEN 'ended'
   WHEN current_sub.plan<>snapshot->>'plan' THEN 'plan_changed'
   WHEN NOT current_sub.cancel_at_period_end AND (snapshot->>'cancelAtPeriodEnd')::boolean THEN 'cancellation_scheduled'
   WHEN current_sub.cancel_at_period_end AND NOT (snapshot->>'cancelAtPeriodEnd')::boolean THEN 'cancellation_resumed'
   ELSE 'updated' END;
  UPDATE subscriptions SET customer_id=snapshot->>'customerId',subscription_id=snapshot->>'id',plan=snapshot->>'plan',status=snapshot->>'status',current_period_end=(snapshot->>'periodEnd')::timestamptz,cancel_at_period_end=(snapshot->>'cancelAtPeriodEnd')::boolean,provider_created_at=incoming_created,updated_at=clock_timestamp() WHERE user_id=target_user;
 END IF;
 INSERT INTO subscription_history(user_id,event_id,event_type,event_created_at,observed_at,generation,subscription_id,plan,status,cancel_at_period_end,applied,transition,was_paid,is_paid)
 VALUES(target_user,target_event,event_type,event_created,clock_timestamp(),owner_generation,snapshot->>'id',snapshot->>'plan',snapshot->>'status',(snapshot->>'cancelAtPeriodEnd')::boolean,accepted,reason,previous_paid,next_paid);
 RETURN reason;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION billing_metrics(as_of timestamptz DEFAULT now())
RETURNS TABLE(active_accounts bigint,scheduled_cancellations bigint,catalog_mrr bigint,tracking_since timestamptz,coverage_complete boolean,cohort_accounts bigint,lost_cohort_accounts bigint,observed_losses bigint,churn_percent numeric)
LANGUAGE sql STABLE AS $$
 WITH start AS (SELECT started_at FROM billing_observation WHERE id='subscriptions'),
 current_totals AS (SELECT count(*) FILTER(WHERE status='active' AND plan IN ('pro','founder','agency')) AS active,
 count(*) FILTER(WHERE status='active' AND plan IN ('pro','founder','agency') AND cancel_at_period_end) AS scheduled,
 coalesce(sum(CASE WHEN status='active' THEN CASE plan WHEN 'pro' THEN 29 WHEN 'founder' THEN 79 WHEN 'agency' THEN 199 ELSE 0 END ELSE 0 END),0)::bigint AS mrr FROM subscriptions),
 cohort_state AS (SELECT DISTINCT ON(user_id) user_id,is_paid FROM subscription_history WHERE applied AND observed_at<=as_of-interval '720 hours' ORDER BY user_id,observed_at DESC,generation DESC),
 cohort AS (SELECT user_id FROM cohort_state WHERE is_paid),
 losses AS (SELECT DISTINCT user_id FROM subscription_history WHERE applied AND was_paid AND NOT is_paid AND observed_at>as_of-interval '720 hours' AND observed_at<=as_of),
 counts AS (SELECT (SELECT count(*) FROM cohort) AS cohort,(SELECT count(*) FROM cohort JOIN losses USING(user_id)) AS lost,(SELECT count(*) FROM losses) AS observed)
 SELECT t.active,t.scheduled,t.mrr,s.started_at,s.started_at<=as_of-interval '720 hours',c.cohort,c.lost,c.observed,
 CASE WHEN s.started_at<=as_of-interval '720 hours' AND c.cohort>0 THEN round(c.lost*100.0/c.cohort,2) ELSE NULL END
 FROM current_totals t CROSS JOIN start s CROSS JOIN counts c;
$$;
