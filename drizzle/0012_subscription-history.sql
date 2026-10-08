CREATE TABLE "billing_observation" (
	"id" text PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_id" text,
	"event_type" text NOT NULL,
	"event_created_at" timestamp with time zone,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generation" bigint DEFAULT 0 NOT NULL,
	"subscription_id" text,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"cancel_at_period_end" boolean NOT NULL,
	"applied" boolean NOT NULL,
	"transition" text NOT NULL,
	"was_paid" boolean NOT NULL,
	"is_paid" boolean NOT NULL,
	CONSTRAINT "subscription_history_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "provider_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "sync_generation" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_event_id_webhook_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."webhook_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_history_user_time_idx" ON "subscription_history" USING btree ("user_id","observed_at","generation");--> statement-breakpoint
CREATE INDEX "subscription_history_time_idx" ON "subscription_history" USING btree ("observed_at");