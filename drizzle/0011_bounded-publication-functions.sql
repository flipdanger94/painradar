ALTER TABLE publication_jobs ADD CONSTRAINT publication_scope_check CHECK ((kind='radar' AND radar_id IS NOT NULL AND workspace_id IS NULL) OR (kind='workspace' AND workspace_id IS NOT NULL AND radar_id IS NULL));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION capture_daily_snapshots(target_day date) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('painradar:snapshot:'||target_day));
 SELECT count(*) INTO n FROM opportunity_snapshots WHERE day=target_day;
 IF n>0 THEN RETURN n; END IF;
 INSERT INTO opportunity_snapshots(opportunity_id,day,score,mentions,velocity,rank,confidence)
 SELECT id,target_day,score,mentions,growth_7d,row_number() OVER(ORDER BY score DESC,id ASC),confidence FROM opportunities;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enqueue_publications(target_day date) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer; m integer;
BEGIN
 INSERT INTO publication_jobs(kind,radar_id,day)
 SELECT 'radar',r.id,target_day FROM radars r WHERE (r.frequency='daily' OR extract(dow FROM target_day)=1)
 AND (r.workspace_id IS NULL OR EXISTS(SELECT 1 FROM workspaces w JOIN teams t ON t.id=w.team_id WHERE w.id=r.workspace_id AND agency_active(t.owner_id)))
 ON CONFLICT(radar_id,day) DO NOTHING; GET DIAGNOSTICS n=ROW_COUNT;
 INSERT INTO publication_jobs(kind,workspace_id,day)
 SELECT 'workspace',w.id,target_day FROM workspaces w JOIN teams t ON t.id=w.team_id WHERE agency_active(t.owner_id)
 ON CONFLICT(workspace_id,day) DO NOTHING; GET DIAGNOSTICS m=ROW_COUNT;
 RETURN n+m;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION claim_publications(owner_token uuid,batch_size integer DEFAULT 5)
RETURNS SETOF publication_jobs LANGUAGE plpgsql AS $$
BEGIN
 UPDATE publication_jobs SET status='expired',lease_token=NULL,lease_until=NULL,last_error='Publication exceeded seven-day queue retention' WHERE status='pending' AND day<current_date-7 AND (lease_until IS NULL OR lease_until<now());
 RETURN QUERY WITH candidates AS (
 SELECT p.id FROM publication_jobs p LEFT JOIN radars r ON r.id=p.radar_id
 LEFT JOIN workspaces w ON w.id=coalesce(p.workspace_id,r.workspace_id) LEFT JOIN teams t ON t.id=w.team_id
 WHERE p.status='pending' AND (p.lease_until IS NULL OR p.lease_until<now()) AND (w.id IS NULL OR agency_active(t.owner_id))
 ORDER BY p.updated_at,p.id FOR UPDATE OF p SKIP LOCKED LIMIT least(5,greatest(1,batch_size))
 ) UPDATE publication_jobs p SET lease_token=owner_token,lease_until=now()+interval '20 minutes',updated_at=now() FROM candidates c WHERE p.id=c.id RETURNING p.*;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION process_radar_publication(job_id uuid,owner_token uuid,batch_size integer DEFAULT 100)
RETURNS TABLE(complete boolean,scanned integer,created integer,lease_lost boolean) LANGUAGE plpgsql AS $$
DECLARE job publication_jobs; radar radars; next_id uuid; page_ids uuid[]; n integer; k integer;
BEGIN
 SELECT * INTO job FROM publication_jobs WHERE id=job_id FOR UPDATE;
 IF NOT FOUND OR job.kind<>'radar' OR job.status<>'pending' OR job.lease_token IS DISTINCT FROM owner_token OR job.lease_until<now() THEN RETURN QUERY SELECT false,0,0,true; RETURN; END IF;
 SELECT * INTO radar FROM radars WHERE id=job.radar_id;
 IF radar.workspace_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM workspaces w JOIN teams t ON t.id=w.team_id WHERE w.id=radar.workspace_id AND agency_active(t.owner_id)) THEN
 UPDATE publication_jobs SET lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=job.id; RETURN QUERY SELECT false,0,0,true; RETURN;
 END IF;
 SELECT array_agg(p.opportunity_id ORDER BY p.opportunity_id) INTO page_ids FROM (SELECT s.opportunity_id FROM opportunity_snapshots s WHERE s.day=job.day AND (job.cursor IS NULL OR s.opportunity_id>job.cursor) ORDER BY s.opportunity_id LIMIT least(100,greatest(1,batch_size))) p;
 n=coalesce(array_length(page_ids,1),0);
 IF n=0 THEN UPDATE publication_jobs SET status='completed',completed_at=now(),lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=job.id; RETURN QUERY SELECT true,0,0,false; RETURN; END IF;
 next_id=page_ids[n];
 WITH candidates AS (
 SELECT o.*,s.score AS observed_score,s.mentions AS observed_mentions,s.confidence AS observed_confidence,
 CASE WHEN p.id IS NULL THEN 'new_opportunity' WHEN s.score-p.score>=5 THEN 'score_increase' WHEN p.mentions>0 AND s.mentions>=p.mentions*1.5 THEN 'mentions_spike' WHEN s.velocity IS NOT NULL AND p.velocity IS NOT NULL AND s.velocity-p.velocity>=20 THEN 'trend_acceleration' ELSE NULL END AS event_type
 FROM opportunity_snapshots s JOIN opportunities o ON o.id=s.opportunity_id LEFT JOIN opportunity_snapshots p ON p.opportunity_id=o.id AND p.day=job.day-1
 WHERE s.day=job.day AND s.opportunity_id=ANY(page_ids) AND s.score>=radar.alert_threshold
 AND EXISTS(SELECT 1 FROM radar_keywords rk WHERE rk.radar_id=radar.id AND strpos(lower(o.title||' '||o.summary||' '||o.industry),lower(rk.keyword))>0)
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(radar.excluded_words) v WHERE strpos(lower(o.title||' '||o.summary||' '||o.industry),lower(v.value))>0)
 AND (jsonb_array_length(radar.industries)=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(radar.industries) v WHERE lower(v.value)=lower(o.industry)))
 AND EXISTS(SELECT 1 FROM cluster_signals cs JOIN raw_signals raw ON raw.id=cs.signal_id WHERE cs.cluster_id=o.cluster_id AND radar.sources ? raw.source AND radar.languages ? raw.language)
 ), matched AS (SELECT * FROM candidates WHERE event_type IS NOT NULL), audience AS (
 SELECT u.id FROM users u WHERE (radar.workspace_id IS NULL AND u.id=radar.user_id) OR (radar.workspace_id IS NOT NULL AND workspace_role(radar.workspace_id,u.id) IS NOT NULL)
 ), inserted AS (
 INSERT INTO notifications(user_id,workspace_id,dedupe_key,type,title,body,opportunity_id)
 SELECT a.id,radar.workspace_id,radar.id||':'||m.id||':'||job.day||':'||m.event_type||':'||a.id,m.event_type,m.title,m.observed_mentions||' signals · Score '||m.observed_score||'/100 · '||m.observed_confidence||' confidence',m.id FROM matched m CROSS JOIN audience a ON CONFLICT(dedupe_key) DO NOTHING RETURNING id
 ), outbox AS (
 INSERT INTO webhook_deliveries(webhook_id,event_key,payload)
 SELECT h.id,radar.id||':'||m.id||':'||job.day||':'||m.event_type,jsonb_build_object('type',m.event_type,'workspaceId',radar.workspace_id,'data',jsonb_build_object('opportunityId',m.id,'title',m.title,'score',m.observed_score,'mentions',m.observed_mentions))
 FROM matched m JOIN outbound_webhooks h ON h.workspace_id=radar.workspace_id AND h.enabled AND h.events ? m.event_type
 WHERE EXISTS(SELECT 1 FROM audience) ON CONFLICT(webhook_id,event_key) DO NOTHING RETURNING id
 ) SELECT count(*) INTO k FROM inserted;
 UPDATE publication_jobs SET cursor=next_id,lease_until=now()+interval '20 minutes',updated_at=now(),last_error=NULL WHERE id=job.id;
 RETURN QUERY SELECT false,n,k,false;
END;
$$;
