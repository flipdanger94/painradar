CREATE TABLE "competitor_research" (
	"opportunity_id" uuid PRIMARY KEY NOT NULL,
	"results" jsonb NOT NULL,
	"sources" jsonb NOT NULL,
	"researched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competitor_research" ADD CONSTRAINT "competitor_research_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;