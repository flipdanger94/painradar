ALTER TABLE subscription_history ADD CONSTRAINT subscription_observation_scope_check CHECK (event_id IS NULL OR reconciliation_id IS NULL);
--> statement-breakpoint
CREATE FUNCTION apply_subscription_observation(target_user text,target_event text,event_type text,event_created timestamptz,owner_generation bigint,snapshot jsonb,existing_created timestamptz DEFAULT NULL,existing_status text DEFAULT NULL,target_reconciliation uuid DEFAULT NULL,owner_lease uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE current_sub subscriptions; accepted boolean; reason text; previous_paid boolean; next_paid boolean; inserted_event text; incoming_created timestamptz;
BEGIN
 PERFORM 1 FROM users WHERE id=target_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subscription user is missing'; END IF;
 SELECT * INTO current_sub FROM subscriptions WHERE user_id=target_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Subscription synchronization was not started'; END IF;
 IF target_reconciliation IS NOT NULL THEN
  IF target_event IS NOT NULL THEN RAISE EXCEPTION 'Observation scope is ambiguous'; END IF;
  IF EXISTS(SELECT 1 FROM subscription_history WHERE reconciliation_id=target_reconciliation AND user_id=target_user) THEN RETURN 'duplicate'; END IF;
  IF current_sub.reconciliation_lease_token IS DISTINCT FROM owner_lease OR current_sub.reconciliation_lease_until IS NULL OR current_sub.reconciliation_lease_until<=now() OR current_sub.customer_id IS DISTINCT FROM snapshot->>'customerId' THEN RETURN 'lease_lost'; END IF;
 ELSE
  IF target_event IS NULL THEN RAISE EXCEPTION 'Webhook event is missing'; END IF;
  IF EXISTS(SELECT 1 FROM webhook_events WHERE id=target_event) THEN RETURN 'duplicate'; END IF;
 END IF;
 IF current_sub.sync_generation<>owner_generation THEN RETURN 'superseded'; END IF;
 IF target_reconciliation IS NULL THEN
  INSERT INTO webhook_events(id) VALUES(target_event) ON CONFLICT DO NOTHING RETURNING id INTO inserted_event;
  IF inserted_event IS NULL THEN RETURN 'duplicate'; END IF;
 END IF;
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
 INSERT INTO subscription_history(user_id,event_id,reconciliation_id,event_type,event_created_at,observed_at,generation,subscription_id,plan,status,cancel_at_period_end,applied,transition,was_paid,is_paid)
 VALUES(target_user,target_event,target_reconciliation,event_type,event_created,clock_timestamp(),owner_generation,snapshot->>'id',snapshot->>'plan',snapshot->>'status',(snapshot->>'cancelAtPeriodEnd')::boolean,accepted,reason,previous_paid,next_paid);
 IF target_reconciliation IS NOT NULL THEN
  UPDATE subscriptions SET reconciled_at=clock_timestamp(),reconciliation_next_at=now()+interval '6 hours',reconciliation_lease_token=NULL,reconciliation_lease_until=NULL,reconciliation_error=NULL,reconciliation_failures=0,last_reconciliation_id=target_reconciliation WHERE user_id=target_user;
 END IF;
 RETURN reason;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION apply_subscription_sync(target_user text,target_event text,event_type text,event_created timestamptz,owner_generation bigint,snapshot jsonb,existing_created timestamptz DEFAULT NULL,existing_status text DEFAULT NULL)
RETURNS text LANGUAGE sql AS $$ SELECT apply_subscription_observation(target_user,target_event,event_type,event_created,owner_generation,snapshot,existing_created,existing_status); $$;
--> statement-breakpoint
CREATE FUNCTION register_billing_customer(target_user text,provider_customer text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE result text;
BEGIN
 PERFORM 1 FROM users WHERE id=target_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Billing user is missing'; END IF;
 INSERT INTO subscriptions(user_id,customer_id) VALUES(target_user,provider_customer)
 ON CONFLICT(user_id) DO UPDATE SET customer_id=coalesce(subscriptions.customer_id,excluded.customer_id)
 RETURNING customer_id INTO result;
 RETURN result;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION claim_billing_reconciliations(owner_token uuid,batch_size integer DEFAULT 10)
RETURNS TABLE(user_id text,reconciliation_id uuid) LANGUAGE plpgsql AS $$
BEGIN
 RETURN QUERY WITH candidates AS (
 SELECT s.id FROM subscriptions s WHERE s.customer_id IS NOT NULL AND s.reconciliation_next_at<=now() AND (s.reconciliation_lease_until IS NULL OR s.reconciliation_lease_until<=now())
 ORDER BY s.reconciliation_next_at,s.user_id FOR UPDATE SKIP LOCKED LIMIT least(10,greatest(1,batch_size))
 ) UPDATE subscriptions s SET reconciliation_lease_token=owner_token,reconciliation_lease_until=now()+interval '15 minutes' FROM candidates c WHERE s.id=c.id RETURNING s.user_id,gen_random_uuid();
END;
$$;
--> statement-breakpoint
CREATE FUNCTION begin_billing_reconciliation(target_user text,owner_token uuid,observation_id uuid)
RETURNS TABLE(generation bigint,customer_id text,current_subscription_id text,already_completed boolean) LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM users WHERE id=target_user FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM subscription_history h WHERE h.reconciliation_id=observation_id AND h.user_id=target_user) THEN RETURN QUERY SELECT 0::bigint,NULL::text,NULL::text,true; RETURN; END IF;
 RETURN QUERY UPDATE subscriptions s SET sync_generation=nextval('billing_sync_generation'),reconciliation_lease_until=now()+interval '15 minutes'
 WHERE s.user_id=target_user AND s.customer_id IS NOT NULL AND s.reconciliation_lease_token=owner_token AND s.reconciliation_lease_until>now()
 RETURNING s.sync_generation,s.customer_id,s.subscription_id,false;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION complete_empty_billing_reconciliation(target_user text,owner_token uuid,observation_id uuid,owner_generation bigint)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE s subscriptions; paid boolean;
BEGIN
 PERFORM 1 FROM users WHERE id=target_user FOR UPDATE;
 IF NOT FOUND THEN RETURN 'lease_lost'; END IF;
 SELECT * INTO s FROM subscriptions WHERE user_id=target_user FOR UPDATE;
 IF EXISTS(SELECT 1 FROM subscription_history WHERE reconciliation_id=observation_id AND user_id=target_user) THEN RETURN 'duplicate'; END IF;
 IF NOT FOUND OR s.reconciliation_lease_token IS DISTINCT FROM owner_token OR s.reconciliation_lease_until IS NULL OR s.reconciliation_lease_until<=now() THEN RETURN 'lease_lost'; END IF;
 IF s.sync_generation<>owner_generation THEN RETURN 'superseded'; END IF;
 IF s.subscription_id IS NOT NULL THEN RETURN 'superseded'; END IF;
 paid=s.status='active' AND s.plan IN ('pro','founder','agency');
 INSERT INTO subscription_history(user_id,reconciliation_id,event_type,observed_at,generation,plan,status,cancel_at_period_end,applied,transition,was_paid,is_paid)
 VALUES(target_user,observation_id,'reconciliation',clock_timestamp(),owner_generation,s.plan,s.status,s.cancel_at_period_end,true,'reconciled_empty',paid,paid);
 UPDATE subscriptions SET reconciled_at=clock_timestamp(),reconciliation_next_at=now()+interval '6 hours',reconciliation_lease_token=NULL,reconciliation_lease_until=NULL,reconciliation_error=NULL,reconciliation_failures=0,last_reconciliation_id=observation_id WHERE user_id=target_user;
 RETURN 'empty';
END;
$$;
--> statement-breakpoint
CREATE FUNCTION fail_billing_reconciliation(target_user text,owner_token uuid) RETURNS void LANGUAGE sql AS $$
 UPDATE subscriptions SET reconciliation_lease_token=NULL,reconciliation_lease_until=NULL,reconciliation_error='Stripe reconciliation failed; review provider configuration and subscription ambiguity',reconciliation_failures=reconciliation_failures+1,reconciliation_next_at=now()+make_interval(mins=>least(360,(5*power(2,least(reconciliation_failures,7)))::integer))
 WHERE user_id=target_user AND reconciliation_lease_token=owner_token;
$$;
