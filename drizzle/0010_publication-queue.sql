CREATE TABLE "pipeline_cursors" (
	"id" text PRIMARY KEY NOT NULL,
	"cursor" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publication_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"radar_id" uuid,
	"workspace_id" uuid,
	"day" date NOT NULL,
	"cursor" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "publication_jobs" ADD CONSTRAINT "publication_jobs_radar_id_radars_id_fk" FOREIGN KEY ("radar_id") REFERENCES "public"."radars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_jobs" ADD CONSTRAINT "publication_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "publication_radar_day_idx" ON "publication_jobs" USING btree ("radar_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "publication_workspace_day_idx" ON "publication_jobs" USING btree ("workspace_id","day");--> statement-breakpoint
CREATE INDEX "publication_queue_idx" ON "publication_jobs" USING btree ("status","updated_at");