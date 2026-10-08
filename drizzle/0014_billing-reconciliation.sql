ALTER TABLE "subscription_history" ADD COLUMN "reconciliation_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "reconciled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "reconciliation_next_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "reconciliation_lease_token" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "reconciliation_lease_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "reconciliation_error" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "reconciliation_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "last_reconciliation_id" uuid;--> statement-breakpoint
CREATE INDEX "subscription_reconciliation_due_idx" ON "subscriptions" USING btree ("reconciliation_next_at","user_id");--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_reconciliation_id_unique" UNIQUE("reconciliation_id");