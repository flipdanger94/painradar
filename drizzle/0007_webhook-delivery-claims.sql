-- Atomically lease a bounded batch. Disabled destinations and expired sponsors pause delivery.
CREATE OR REPLACE FUNCTION claim_webhook_deliveries(batch_size integer DEFAULT 10)
RETURNS TABLE(id uuid,webhook_id uuid,payload jsonb,attempts integer,url text,secret_ciphertext text)
LANGUAGE sql AS $$
 WITH candidates AS (
  SELECT d.id FROM webhook_deliveries d
  JOIN outbound_webhooks h ON h.id=d.webhook_id
  JOIN workspaces w ON w.id=h.workspace_id JOIN teams t ON t.id=w.team_id
  WHERE h.enabled AND agency_active(t.owner_id) AND d.attempts<6
   AND ((d.status='pending' AND d.next_attempt_at<=now()) OR (d.status='sending' AND d.lease_until<now()))
  ORDER BY d.next_attempt_at FOR UPDATE OF d SKIP LOCKED LIMIT least(10,greatest(1,batch_size))
 ), claimed AS (
  UPDATE webhook_deliveries d SET status='sending',attempts=d.attempts+1,lease_until=now()+interval '3 minutes'
  FROM candidates c WHERE d.id=c.id RETURNING d.*
 ) SELECT c.id,c.webhook_id,c.payload,c.attempts,h.url,h.secret_ciphertext FROM claimed c JOIN outbound_webhooks h ON h.id=c.webhook_id;
$$;
--> statement-breakpoint
-- Report snapshot and its webhook outbox commit together; retries preserve the snapshot.
CREATE OR REPLACE FUNCTION create_workspace_report(target_workspace uuid,target_period text,target_start date,target_end date,report_content jsonb)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE report_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM workspaces w JOIN teams t ON t.id=w.team_id WHERE w.id=target_workspace AND agency_active(t.owner_id)) THEN RETURN NULL; END IF;
 INSERT INTO workspace_reports(workspace_id,period,start_day,end_day,content)
 VALUES(target_workspace,target_period,target_start,target_end,report_content)
 ON CONFLICT(workspace_id,period,end_day) DO NOTHING RETURNING id INTO report_id;
 IF report_id IS NULL THEN SELECT id INTO report_id FROM workspace_reports WHERE workspace_id=target_workspace AND period=target_period AND end_day=target_end; END IF;
 INSERT INTO webhook_deliveries(webhook_id,event_key,payload)
 SELECT h.id,'report:'||report_id,jsonb_build_object('type','report_ready','workspaceId',target_workspace,'data',jsonb_build_object('reportId',report_id,'period',target_period,'endDay',target_end))
 FROM outbound_webhooks h WHERE h.workspace_id=target_workspace AND h.enabled AND h.events ? 'report_ready'
 ON CONFLICT(webhook_id,event_key) DO NOTHING;
 RETURN report_id;
END;
$$;
