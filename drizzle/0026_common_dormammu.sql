ALTER TABLE "sources" ADD COLUMN "retry_after" timestamp with time zone;--> statement-breakpoint
INSERT INTO sources(id,name,enabled,config) VALUES
('stackexchange','Stack Exchange',false,'{}'),('gitlab','GitLab Issues',false,'{}'),('discourse','Discourse',false,'{}'),('rss','RSS / Atom',false,'{}'),('csv','CSV import',false,'{}')
ON CONFLICT(id) DO NOTHING;
