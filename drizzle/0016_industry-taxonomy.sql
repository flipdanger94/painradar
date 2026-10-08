-- Canonical taxonomy v1. Existing raw labels and snapshots are preserved.
CREATE FUNCTION canonical_industry(value text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
select case lower(regexp_replace(trim(coalesce(value,'')),'\s+',' ','g'))
when 'developer tools' then 'Developer tools'
when 'business operations' then 'Business operations'
when 'marketing' then 'Marketing'
when 'sales' then 'Sales'
when 'customer support' then 'Customer support'
when 'finance' then 'Finance'
when 'healthcare' then 'Healthcare'
when 'education' then 'Education'
when 'e-commerce' then 'E-commerce'
when 'human resources' then 'Human resources'
when 'legal' then 'Legal'
when 'real estate' then 'Real estate'
when 'travel' then 'Travel'
when 'logistics' then 'Logistics'
when 'media' then 'Media'
when 'other / unclear' then 'Other / unclear'
when 'devtools' then 'Developer tools'
when 'developer tooling' then 'Developer tools'
when 'software development' then 'Developer tools'
when 'инструменты разработчика' then 'Developer tools'
when 'operations' then 'Business operations'
when 'productivity' then 'Business operations'
when 'бизнес-процессы' then 'Business operations'
when 'маркетинг' then 'Marketing'
when 'продажи' then 'Sales'
when 'поддержка клиентов' then 'Customer support'
when 'customer service' then 'Customer support'
when 'финансы' then 'Finance'
when 'fintech' then 'Finance'
when 'здравоохранение' then 'Healthcare'
when 'медицина' then 'Healthcare'
when 'health' then 'Healthcare'
when 'образование' then 'Education'
when 'edtech' then 'Education'
when 'ecommerce' then 'E-commerce'
when 'электронная коммерция' then 'E-commerce'
when 'hr' then 'Human resources'
when 'кадры' then 'Human resources'
when 'юриспруденция' then 'Legal'
when 'недвижимость' then 'Real estate'
when 'туризм' then 'Travel'
when 'логистика' then 'Logistics'
when 'медиа' then 'Media'
else 'Other / unclear' end
$$;
--> statement-breakpoint
CREATE FUNCTION industry_matches(value text, filter text) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
select case when canonical_industry(filter)='Other / unclear' and lower(trim(filter))<>'other / unclear'
then lower(trim(value))=lower(trim(filter))
else canonical_industry(value)=canonical_industry(filter) end
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
 AND (jsonb_array_length(radar.industries)=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(radar.industries) v WHERE industry_matches(o.industry,v.value)))
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
