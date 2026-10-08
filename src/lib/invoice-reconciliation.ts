import { sql } from "drizzle-orm";
import { db } from "@/db";
import { stripe } from "./stripe";
import { invoiceSnapshot } from "./invoice-sync";

export async function claimInvoiceReconciliations(token: string) {
  const result = await db().execute(
    sql`select * from claim_invoice_reconciliations(${token}::uuid)`,
  );
  return result.rows.map((row) => ({ customerId: String(row.customer_id) }));
}
export async function failInvoiceReconciliation(
  customerId: string,
  token: string,
) {
  await db().execute(
    sql`select fail_invoice_reconciliation(${customerId},${token}::uuid)`,
  );
}
/** One bounded page. Cursor advances only after all fresh observations commit. */
export async function reconcileInvoices(customerId: string, token: string) {
  const owner = (
    await db().execute(
      sql`select cursor,frozen_until::text from invoice_reconciliation_queue where customer_id=${customerId} and lease_token=${token}::uuid and lease_until>clock_timestamp() and exists(select 1 from subscriptions where customer_id=${customerId})`,
    )
  ).rows[0];
  if (!owner) return { result: "lease_lost", processed: 0 };
  const cursor = owner.cursor == null ? null : String(owner.cursor);
  const boundary = Math.floor(
    new Date(String(owner.frozen_until)).getTime() / 1000,
  );
  if (!Number.isSafeInteger(boundary))
    throw new Error("Invoice scan boundary missing");
  const client = stripe();
  const page = await client.invoices.list({
    customer: customerId,
    limit: 10,
    created: { lte: boundary },
    ...(cursor ? { starting_after: cursor } : {}),
  });
  if (
    !Array.isArray(page.data) ||
    page.data.length > 10 ||
    typeof page.has_more !== "boolean" ||
    (page.has_more && !page.data.length)
  )
    throw new Error("Invalid invoice page");
  const seen = new Set<string>();
  for (const item of page.data) {
    const customer =
      typeof item.customer === "string" ? item.customer : item.customer?.id;
    if (
      typeof item.id !== "string" ||
      !item.id ||
      item.id.length > 255 ||
      seen.has(item.id) ||
      item.id === cursor ||
      customer !== customerId ||
      !Number.isSafeInteger(item.created) ||
      item.created > boundary
    )
      throw new Error("Invoice page scope or pagination changed");
    seen.add(item.id);
  }
  for (const item of page.data) {
    // Allocate before the provider GET, sharing the webhook generation fence.
    const begin = await db().execute(
      sql`select begin_invoice_observation(${item.id},${customerId},null,${token}::uuid) as generation`,
    );
    const generation = begin.rows[0]?.generation;
    if (generation == null) throw new Error("Invoice generation missing");
    const snapshot = invoiceSnapshot(await client.invoices.retrieve(item.id));
    if (snapshot.id !== item.id || snapshot.customerId !== customerId)
      throw new Error("Invoice Customer scope changed");
    const applied = await db().execute(
      sql`select apply_invoice_observation(${item.id},${customerId},null,${String(generation)}::bigint,${JSON.stringify(snapshot)}::jsonb,${token}::uuid) as result`,
    );
    if (applied.rows[0]?.result !== "applied")
      throw new Error("Invoice synchronization superseded; retry required");
  }
  const finish = await db().execute(
    sql`select finish_invoice_reconciliation_page(${customerId},${token}::uuid,${cursor},${page.data.at(-1)?.id || null},${page.has_more}) as result`,
  );
  return {
    result: String(finish.rows[0]?.result),
    processed: page.data.length,
  };
}
export async function invoiceReconciliationHealth() {
  return (
    await db().execute(
      sql`select count(*) as tracked,count(*) filter(where q.completed_at is null) as never,count(*) filter(where q.customer_id is null or q.next_at<=now()) as due,count(*) filter(where q.cursor is not null) as continuing,count(*) filter(where q.error is not null) as errors,min(q.completed_at)::text as oldest_success from subscriptions s left join invoice_reconciliation_queue q on q.customer_id=s.customer_id where s.customer_id is not null`,
    )
  ).rows[0];
}
export async function recentInvoiceReconciliationErrors() {
  return (
    await db().execute(
      sql`select q.customer_id,q.error,q.failures,q.next_at::text from invoice_reconciliation_queue q join subscriptions s on s.customer_id=q.customer_id where q.error is not null order by q.next_at,q.customer_id limit 10`,
    )
  ).rows;
}
