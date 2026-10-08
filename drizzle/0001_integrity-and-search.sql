CREATE INDEX signal_embedding_idx ON raw_signals USING hnsw (embedding vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX cluster_embedding_idx ON pain_clusters USING hnsw (embedding vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX opportunity_fts_idx ON opportunities USING gin (to_tsvector('simple',title||' '||summary||' '||industry||' '||audience));
--> statement-breakpoint
CREATE INDEX ai_usage_day_idx ON ai_usage(created_at);
--> statement-breakpoint
CREATE INDEX cluster_signal_lookup_idx ON cluster_signals(cluster_id);
--> statement-breakpoint
ALTER TABLE raw_signals ADD CONSTRAINT duplicate_reference FOREIGN KEY(duplicate_of) REFERENCES raw_signals(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE opportunities ADD CONSTRAINT score_range CHECK(score BETWEEN 0 AND 100);
--> statement-breakpoint
ALTER TABLE radars ADD CONSTRAINT radar_threshold_range CHECK(alert_threshold BETWEEN 0 AND 100);
--> statement-breakpoint
CREATE FUNCTION consume_opportunity_open(p_user text,p_opportunity uuid,p_day date,p_limit integer) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM users WHERE id=p_user FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM daily_usage WHERE user_id=p_user AND day=p_day AND opportunity_id=p_opportunity) THEN RETURN true; END IF;
 IF (SELECT count(*) FROM daily_usage WHERE user_id=p_user AND day=p_day)>=p_limit THEN RETURN false; END IF;
 INSERT INTO daily_usage(user_id,day,opportunity_id) VALUES(p_user,p_day,p_opportunity) ON CONFLICT DO NOTHING;
 RETURN true;
END $$;
--> statement-breakpoint
CREATE FUNCTION create_radar_limited(p_id uuid,p_user text,p_name text,p_excluded jsonb,p_industries jsonb,p_sources jsonb,p_languages jsonb,p_threshold integer,p_frequency text,p_keywords jsonb,p_limit integer) RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM users WHERE id=p_user FOR UPDATE;
 IF NOT FOUND THEN RETURN null; END IF;
 IF (SELECT count(*) FROM radars WHERE user_id=p_user)>=p_limit THEN RETURN null; END IF;
 INSERT INTO radars(id,user_id,name,excluded_words,industries,sources,languages,alert_threshold,frequency) VALUES(p_id,p_user,p_name,p_excluded,p_industries,p_sources,p_languages,p_threshold,p_frequency);
 INSERT INTO radar_keywords(radar_id,keyword) SELECT p_id,value FROM jsonb_array_elements_text(p_keywords) ON CONFLICT DO NOTHING;
 RETURN p_id;
END $$;
