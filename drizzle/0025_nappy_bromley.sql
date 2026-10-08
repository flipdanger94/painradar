CREATE TABLE "subscription_grants" (
	"user_id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"granted_by" text,
	"reason" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription_grants" ADD CONSTRAINT "subscription_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_grants" ADD CONSTRAINT "subscription_grants_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE subscription_grants ADD CONSTRAINT subscription_grant_plan_check CHECK(plan IN ('pro','founder','agency'));
--> statement-breakpoint
CREATE FUNCTION manage_subscription_grant(p_actor text,p_email text,p_action text,p_plan text,p_days integer,p_reason text,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE target_id text; prior subscription_grants%ROWTYPE; deadline timestamptz; chosen_plan text; stamp timestamptz := clock_timestamp();
BEGIN
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_actor AND role='admin') THEN
    RETURN jsonb_build_object('error','Administrator access required.','status',403);
  END IF;
  IF p_request IS NULL OR p_action IS NULL OR p_action NOT IN ('grant','extend','revoke') OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 500
    OR (p_action='grant' AND (p_plan IS NULL OR p_plan NOT IN ('pro','founder','agency')))
    OR (p_action<>'revoke' AND p_days IS NOT NULL AND p_days NOT IN (30,90,365)) THEN
    RETURN jsonb_build_object('error','Invalid subscription request.','status',400);
  END IF;
  SELECT id INTO target_id FROM users WHERE lower(email)=lower(btrim(p_email)) FOR UPDATE;
  IF target_id IS NULL THEN RETURN jsonb_build_object('error','User not found.','status',404); END IF;
  IF EXISTS(SELECT 1 FROM audit_logs WHERE action LIKE 'subscription.manual.%' AND metadata->>'requestId'=p_request::text) THEN
    IF EXISTS(SELECT 1 FROM audit_logs WHERE user_id=p_actor AND metadata->>'requestId'=p_request::text AND metadata->>'targetUserId'=target_id) THEN RETURN jsonb_build_object('ok',true); END IF;
    RETURN jsonb_build_object('error','Invalid subscription request.','status',409);
  END IF;
  SELECT * INTO prior FROM subscription_grants WHERE user_id=target_id;
  IF p_action IN ('extend','revoke') AND (prior.user_id IS NULL OR prior.revoked_at IS NOT NULL OR prior.expires_at<=stamp) THEN
    RETURN jsonb_build_object('error','No active manual subscription.','status',409);
  END IF;
  IF p_action='extend' AND prior.expires_at IS NULL THEN
    RETURN jsonb_build_object('error','This subscription is already lifetime.','status',409);
  END IF;
  chosen_plan := CASE WHEN p_action='grant' THEN p_plan ELSE prior.plan END;
  deadline := CASE WHEN p_days IS NULL THEN NULL WHEN p_action='extend' THEN prior.expires_at+make_interval(days=>p_days) ELSE stamp+make_interval(days=>p_days) END;
  IF p_action='revoke' THEN
    UPDATE subscription_grants SET revoked_at=stamp,reason=btrim(p_reason),updated_at=stamp WHERE user_id=target_id;
    deadline:=prior.expires_at;
  ELSE
    INSERT INTO subscription_grants(user_id,plan,expires_at,revoked_at,granted_by,reason,updated_at)
    VALUES(target_id,chosen_plan,deadline,NULL,p_actor,btrim(p_reason),stamp)
    ON CONFLICT(user_id) DO UPDATE SET plan=EXCLUDED.plan,expires_at=EXCLUDED.expires_at,revoked_at=NULL,granted_by=p_actor,reason=EXCLUDED.reason,updated_at=stamp;
  END IF;
  INSERT INTO audit_logs(user_id,action,metadata) VALUES(p_actor,'subscription.manual.'||p_action,
    jsonb_build_object('requestId',p_request,'targetUserId',target_id,'plan',chosen_plan,'expiresAt',deadline,'reason',btrim(p_reason),'previousPlan',prior.plan,'previousExpiresAt',prior.expires_at));
  RETURN jsonb_build_object('ok',true);
END $$;

--> statement-breakpoint
CREATE UNIQUE INDEX subscription_grant_request_idx ON audit_logs((metadata->>'requestId')) WHERE action LIKE 'subscription.manual.%';
