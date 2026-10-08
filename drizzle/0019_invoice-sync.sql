CREATE TABLE "invoice_sync_state" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"generation" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "provider_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "observed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "invoice_customer_created_idx" ON "invoices" USING btree ("customer_id","provider_created_at","id");--> statement-breakpoint
CREATE FUNCTION begin_invoice_sync(target_invoice text,target_customer text,target_event text)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE gen bigint;
BEGIN
 IF target_invoice IS NULL OR target_invoice='' OR target_customer IS NULL OR target_customer='' OR target_event IS NULL OR target_event='' THEN RAISE EXCEPTION 'Invalid invoice identity'; END IF;
 IF EXISTS(SELECT 1 FROM webhook_events WHERE id=target_event) THEN RETURN NULL; END IF;
 PERFORM 1 FROM subscriptions WHERE customer_id=target_customer FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invoice Customer mapping is not available'; END IF;
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
CREATE FUNCTION apply_invoice_sync(target_invoice text,target_customer text,target_event text,target_generation bigint,snapshot jsonb)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE current_generation bigint;
BEGIN
 IF EXISTS(SELECT 1 FROM webhook_events WHERE id=target_event) THEN RETURN 'duplicate'; END IF;
 PERFORM 1 FROM subscriptions WHERE customer_id=target_customer FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invoice Customer mapping is not available'; END IF;
 SELECT generation INTO current_generation FROM invoice_sync_state WHERE id=target_invoice AND customer_id=target_customer FOR UPDATE;
 IF NOT FOUND OR current_generation<>target_generation OR target_generation IS NULL THEN RETURN 'superseded'; END IF;
 IF snapshot->>'id' IS DISTINCT FROM target_invoice OR snapshot->>'customerId' IS DISTINCT FROM target_customer THEN RAISE EXCEPTION 'Invoice snapshot identity mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM invoices WHERE id=target_invoice AND customer_id<>target_customer) THEN RAISE EXCEPTION 'Invoice Customer mismatch'; END IF;
 INSERT INTO webhook_events(id) VALUES(target_event) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN 'duplicate'; END IF;
 INSERT INTO invoices(id,customer_id,amount_paid,currency,status,url,provider_created_at,observed_at)
 VALUES(target_invoice,target_customer,(snapshot->>'amountPaid')::integer,snapshot->>'currency',snapshot->>'status',snapshot->>'url',(snapshot->>'createdAt')::timestamptz,clock_timestamp())
 ON CONFLICT(id) DO UPDATE SET amount_paid=excluded.amount_paid,currency=excluded.currency,status=excluded.status,url=excluded.url,provider_created_at=excluded.provider_created_at,observed_at=excluded.observed_at;
 RETURN 'applied';
END;
$$;
