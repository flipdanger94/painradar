import { z } from "zod";
import { sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { stripe } from "./stripe";
export const invoiceEventTypes = new Set([
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.finalized",
  "invoice.updated",
  "invoice.voided",
  "invoice.marked_uncollectible",
]);
const identity = z.object({
  id: z.string().min(1).max(255),
  customerId: z.string().min(1).max(255),
});
const snapshotSchema = identity.extend({
  amountPaid: z.number().int().min(0).max(2147483647),
  currency: z.string().regex(/^[a-z]{3}$/),
  status: z.enum(["draft", "open", "paid", "void", "uncollectible"]).nullable(),
  url: z
    .url()
    .refine((v) => {
      const u = new URL(v);
      return u.protocol === "https:" && !u.username && !u.password;
    })
    .nullable(),
  createdAt: z.iso.datetime(),
});
export async function synchronizeInvoice(event: Stripe.Event) {
  if (!invoiceEventTypes.has(event.type))
    throw new Error("Unsupported invoice event");
  const object = event.data.object as Stripe.Invoice;
  const claimed = identity.parse({
    id: object.id,
    customerId:
      typeof object.customer === "string"
        ? object.customer
        : object.customer?.id,
  });
  const begin = await db().execute(
    sql`select begin_invoice_sync(${claimed.id},${claimed.customerId},${event.id}) as generation`,
  );
  const generation = begin.rows[0]?.generation;
  if (generation == null) return "duplicate";
  const latest = await stripe().invoices.retrieve(claimed.id);
  const snapshot = invoiceSnapshot(latest);
  if (snapshot.id !== claimed.id || snapshot.customerId !== claimed.customerId)
    throw new Error("Invoice Customer scope changed");
  const result = await db().execute(
    sql`select apply_invoice_sync(${claimed.id},${claimed.customerId},${event.id},${String(generation)}::bigint,${JSON.stringify(snapshot)}::jsonb) as result`,
  );
  const outcome = String(result.rows[0]?.result);
  if (outcome === "superseded")
    throw new Error("Invoice synchronization was superseded; retry required");
  if (!["applied", "duplicate"].includes(outcome))
    throw new Error("Invoice synchronization did not complete");
  return outcome;
}

export function invoiceSnapshot(latest: Stripe.Invoice) {
  return snapshotSchema.parse({
    id: latest.id,
    customerId:
      typeof latest.customer === "string"
        ? latest.customer
        : latest.customer?.id,
    amountPaid: latest.amount_paid,
    currency: latest.currency,
    status: latest.status,
    url: latest.hosted_invoice_url,
    createdAt: new Date(latest.created * 1000).toISOString(),
  });
}
