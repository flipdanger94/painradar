CREATE TABLE "invoice_reconciliation_queue" (
	"customer_id" text PRIMARY KEY NOT NULL,
	"cursor" text,
	"frozen_until" timestamp with time zone,
	"next_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"failures" integer DEFAULT 0 NOT NULL,
	"error" text,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "invoice_reconciliation_due_idx" ON "invoice_reconciliation_queue" USING btree ("next_at");
--> statement-breakpoint
CREATE FUNCTION begin_invoice_observation(target_invoice text,target_customer text,target_event text,owner_token uuid)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE gen bigint;
BEGIN
 IF target_invoice IS NULL OR target_invoice='' OR target_customer IS NULL OR target_customer='' OR (target_event IS NULL AND owner_token IS NULL) OR target_event='' THEN RAISE EXCEPTION 'Invalid invoice identity'; END IF;
 IF EXISTS(SELECT 1 FROM webhook_events WHERE id=target_event) THEN RETURN NULL; END IF;
 PERFORM 1 FROM subscriptions WHERE customer_id=target_customer FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invoice Customer mapping is not available'; END IF;
 IF target_event IS NULL THEN
   PERFORM 1 FROM invoice_reconciliation_queue WHERE customer_id=target_customer AND lease_token=owner_token AND lease_until>clock_timestamp() FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Invoice reconciliation lease lost'; END IF;
 ELSIF owner_token IS NOT NULL OR target_event='' THEN RAISE EXCEPTION 'Invalid invoice observation origin'; END IF;

 IF EXISTS(SELECT 1 FROM invoices WHERE id=target_invoice AND customer_id<>target_customer) THEN RAISE EXCEPTION 'Invoice Customer mismatch'; END IF;
 gen:=nextval('billing_sync_generation');
 INSERT INTO invoice_sync_state(id,customer_id,generation,updated_at) VALUES(target_invoice,target_customer,gen,clock_timestamp())
 ON CONFLICT(id) DO UPDATE SET generation=excluded.generation,updated_at=excluded.updated_at
 WHERE invoice_sync_state.customer_id=excluded.customer_id RETURNING generation INTO gen;
 IF gen IS NULL THEN RAISE EXCEPTION 'Invoice sync Customer mismatch'; END IF;
 RETURN gen;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION apply_invoice_observation(target_invoice text,target_customer text,target_event text,target_generation bigint,snapshot jsonb,owner_token uuid)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE current_generation bigint;
BEGIN
 IF target_event IS NULL AND owner_token IS NULL THEN RAISE EXCEPTION 'Invalid invoice observation origin'; END IF;
 IF EXISTS(SELECT 1 FROM webhook_events WHERE id=target_event) THEN RETURN 'duplicate'; END IF;
 PERFORM 1 FROM subscriptions WHERE customer_id=target_customer FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invoice Customer mapping is not available'; END IF;
 IF target_event IS NULL THEN
   PERFORM 1 FROM invoice_reconciliation_queue WHERE customer_id=target_customer AND lease_token=owner_token AND lease_until>clock_timestamp() FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Invoice reconciliation lease lost'; END IF;
 ELSIF owner_token IS NOT NULL OR target_event='' THEN RAISE EXCEPTION 'Invalid invoice observation origin'; END IF;

 SELECT generation INTO current_generation FROM invoice_sync_state WHERE id=target_invoice AND customer_id=target_customer FOR UPDATE;
 IF NOT FOUND OR current_generation<>target_generation OR target_generation IS NULL THEN RETURN 'superseded'; END IF;
 IF snapshot->>'id' IS DISTINCT FROM target_invoice OR snapshot->>'customerId' IS DISTINCT FROM target_customer THEN RAISE EXCEPTION 'Invoice snapshot identity mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM invoices WHERE id=target_invoice AND customer_id<>target_customer) THEN RAISE EXCEPTION 'Invoice Customer mismatch'; END IF;
 IF target_event IS NOT NULL THEN
  INSERT INTO webhook_events(id) VALUES(target_event) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN 'duplicate'; END IF;
 END IF;
 INSERT INTO invoices(id,customer_id,amount_paid,currency,status,url,provider_created_at,observed_at)
 VALUES(target_invoice,target_customer,(snapshot->>'amountPaid')::integer,snapshot->>'currency',snapshot->>'status',snapshot->>'url',(snapshot->>'createdAt')::timestamptz,clock_timestamp())
 ON CONFLICT(id) DO UPDATE SET amount_paid=excluded.amount_paid,currency=excluded.currency,status=excluded.status,url=excluded.url,provider_created_at=excluded.provider_created_at,observed_at=excluded.observed_at;
 RETURN 'applied';
END;
$$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION begin_invoice_sync(target_invoice text,target_customer text,target_event text)
RETURNS bigint LANGUAGE sql AS $$ SELECT begin_invoice_observation(target_invoice,target_customer,target_event,NULL); $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION apply_invoice_sync(target_invoice text,target_customer text,target_event text,target_generation bigint,snapshot jsonb)
RETURNS text LANGUAGE sql AS $$ SELECT apply_invoice_observation(target_invoice,target_customer,target_event,target_generation,snapshot,NULL); $$;
--> statement-breakpoint
CREATE FUNCTION claim_invoice_reconciliations(owner_token uuid)
RETURNS TABLE(customer_id text) LANGUAGE plpgsql AS $$
BEGIN
 IF owner_token IS NULL THEN RAISE EXCEPTION 'Invoice reconciliation owner required'; END IF;
 INSERT INTO invoice_reconciliation_queue(customer_id) SELECT s.customer_id FROM subscriptions s WHERE s.customer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM invoice_reconciliation_queue q WHERE q.customer_id=s.customer_id) ORDER BY s.customer_id LIMIT 10 ON CONFLICT DO NOTHING;
 RETURN QUERY WITH due AS (
  SELECT q.customer_id FROM invoice_reconciliation_queue q
  WHERE q.next_at<=now() AND (q.lease_until IS NULL OR q.lease_until<=now())
  AND EXISTS(SELECT 1 FROM subscriptions s WHERE s.customer_id=q.customer_id)
  ORDER BY q.next_at,q.customer_id LIMIT 10 FOR UPDATE SKIP LOCKED
 ) UPDATE invoice_reconciliation_queue q SET lease_token=owner_token,lease_until=clock_timestamp()+interval '15 minutes',frozen_until=coalesce(q.frozen_until,clock_timestamp()),updated_at=clock_timestamp()
 FROM due WHERE q.customer_id=due.customer_id RETURNING q.customer_id;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION finish_invoice_reconciliation_page(target_customer text,owner_token uuid,expected_cursor text,last_id text,has_more boolean)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
 IF has_more IS NULL OR (has_more AND (last_id IS NULL OR last_id='' OR last_id IS NOT DISTINCT FROM expected_cursor)) THEN RAISE EXCEPTION 'Invoice pagination did not advance'; END IF;
 UPDATE invoice_reconciliation_queue SET cursor=CASE WHEN has_more THEN last_id ELSE NULL END,
 frozen_until=CASE WHEN has_more THEN frozen_until ELSE NULL END,
 next_at=clock_timestamp()+CASE WHEN has_more THEN interval '5 minutes' ELSE interval '6 hours' END,
 completed_at=CASE WHEN has_more THEN completed_at ELSE clock_timestamp() END,
 lease_token=NULL,lease_until=NULL,failures=0,error=NULL,updated_at=clock_timestamp()
 WHERE customer_id=target_customer AND lease_token=owner_token AND lease_until>clock_timestamp() AND cursor IS NOT DISTINCT FROM expected_cursor
 AND EXISTS(SELECT 1 FROM subscriptions s WHERE s.customer_id=target_customer);
 IF NOT FOUND THEN RETURN 'lease_lost'; END IF;
 RETURN CASE WHEN has_more THEN 'continued' ELSE 'completed' END;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION fail_invoice_reconciliation(target_customer text,owner_token uuid)
RETURNS void LANGUAGE sql AS $$
 UPDATE invoice_reconciliation_queue SET lease_token=NULL,lease_until=NULL,failures=failures+1,error='Invoice scan exhausted retries; inspect provider and mapping',
 next_at=clock_timestamp()+make_interval(mins=>least(360,5*(2^least(failures,7))::integer)),updated_at=clock_timestamp()
 WHERE customer_id=target_customer AND lease_token=owner_token;
$$;
