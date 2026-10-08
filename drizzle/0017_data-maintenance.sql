CREATE TABLE "maintenance_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "raw_signals" ADD COLUMN "retired_at" timestamp with time zone;