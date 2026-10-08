CREATE INDEX "ai_cache_created_idx" ON "ai_cache" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "job_finished_idx" ON "job_runs" USING btree ("finished_at");--> statement-breakpoint
CREATE INDEX "signal_retention_idx" ON "raw_signals" USING btree ("retired_at","published_at");--> statement-breakpoint
ALTER TABLE "raw_signals" ADD CONSTRAINT "signal_retired_payload_check" CHECK ("raw_signals"."retired_at" is null or ("raw_signals"."author"='' and "raw_signals"."title"='' and "raw_signals"."content"='' and "raw_signals"."metadata"='{}'::jsonb and "raw_signals"."embedding" is null));--> statement-breakpoint
-- A row lock closes the race with retiring an unattached signal.
CREATE FUNCTION reject_retired_signal_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE retired timestamptz;
BEGIN
 SELECT retired_at INTO retired FROM raw_signals WHERE id=NEW.signal_id FOR KEY SHARE;
 IF retired IS NOT NULL THEN RAISE EXCEPTION 'Retired signal cannot become evidence'; END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER cluster_signal_retirement_guard BEFORE INSERT OR UPDATE OF signal_id ON cluster_signals
FOR EACH ROW EXECUTE FUNCTION reject_retired_signal_link();
--> statement-breakpoint
CREATE FUNCTION run_data_maintenance(target_run uuid,signal_days integer,cache_days integer,log_days integer,preview boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb; stamp timestamptz := now(); signals uuid[]; caches text[]; logs text[];
 signal_count integer; cache_count integer; log_count integer;
 retired integer := 0; cache_deleted integer := 0; log_deleted integer := 0;
BEGIN
 IF target_run IS NULL OR preview IS NULL OR signal_days IS NULL OR cache_days IS NULL OR log_days IS NULL
 OR signal_days NOT BETWEEN 30 AND 3650 OR cache_days NOT BETWEEN 7 AND 365 OR log_days NOT BETWEEN 30 AND 3650
 THEN RAISE EXCEPTION 'Invalid maintenance policy'; END IF;
 SELECT m.result INTO result FROM maintenance_runs m WHERE m.id=target_run;
 IF FOUND THEN RETURN result; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtext('painradar:data-maintenance')) THEN RETURN jsonb_build_object('busy',true); END IF;
 -- Another completed invocation may have committed between the first read and lock.
 SELECT m.result INTO result FROM maintenance_runs m WHERE m.id=target_run;
 IF FOUND THEN RETURN result; END IF;
 SELECT coalesce(array_agg(id),'{}'::uuid[]) INTO signals FROM (
  SELECT s.id FROM raw_signals s WHERE s.retired_at IS NULL AND s.processed_at IS NOT NULL
  AND s.published_at<stamp-make_interval(days=>signal_days)
  AND s.created_at<stamp-interval '7 days' AND s.processed_at<stamp-interval '1 day'
  AND NOT EXISTS(SELECT 1 FROM cluster_signals cs WHERE cs.signal_id=s.id)
  ORDER BY s.published_at,s.id LIMIT 501 FOR UPDATE OF s SKIP LOCKED
 ) candidates;
 SELECT coalesce(array_agg(key),'{}'::text[]) INTO caches FROM (
  SELECT key FROM ai_cache WHERE created_at<stamp-make_interval(days=>cache_days)
  ORDER BY created_at,key LIMIT 501 FOR UPDATE SKIP LOCKED
 ) candidates;
 SELECT coalesce(array_agg(id),'{}'::text[]) INTO logs FROM (
  SELECT id FROM job_runs WHERE status IN ('completed','failed') AND finished_at<stamp-make_interval(days=>log_days)
  ORDER BY finished_at,id LIMIT 501 FOR UPDATE SKIP LOCKED
 ) candidates;
 signal_count:=cardinality(signals); cache_count:=cardinality(caches); log_count:=cardinality(logs);
 IF NOT preview THEN
  UPDATE raw_signals SET retired_at=stamp,author='',title='',content='',metadata='{}'::jsonb,embedding=NULL
  WHERE id=ANY(signals[1:500]); GET DIAGNOSTICS retired=ROW_COUNT;
  DELETE FROM ai_cache WHERE key=ANY(caches[1:500]); GET DIAGNOSTICS cache_deleted=ROW_COUNT;
  DELETE FROM job_runs WHERE id=ANY(logs[1:500]); GET DIAGNOSTICS log_deleted=ROW_COUNT;
 END IF;
 result:=jsonb_build_object('busy',false,'preview',preview,'observedAt',stamp,
 'signalDays',signal_days,'cacheDays',cache_days,'logDays',log_days,
 'signalsEligible',least(500,signal_count),'cacheEligible',least(500,cache_count),'logsEligible',least(500,log_count),
 'signalsRetired',retired,'cacheDeleted',cache_deleted,'logsDeleted',log_deleted,
 'signalsMore',signal_count>500,'cacheMore',cache_count>500,'logsMore',log_count>500);
 INSERT INTO maintenance_runs(id,result,created_at) VALUES(target_run,result,stamp);
 RETURN result;
END;
$$;
