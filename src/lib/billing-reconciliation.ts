import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { stripe } from "./stripe";
import { subscriptionSnapshot } from "./billing-history";

export async function ensureBillingCustomer(userId: string) {
  const existing = await db().execute(
    sql`select customer_id from subscriptions where user_id=${userId}`,
  );
  if (existing.rows[0]?.customer_id)
    return String(existing.rows[0].customer_id);
  const customer = await stripe().customers.create(
    { metadata: { userId } },
    {
      idempotencyKey: createHash("sha256")
        .update("painradar-customer:" + userId)
        .digest("hex"),
    },
  );
  const saved = await db().execute(
    sql`select register_billing_customer(${userId},${customer.id}) as customer_id`,
  );
  return String(saved.rows[0].customer_id);
}
export async function claimBillingReconciliations(token: string) {
  const result = await db().execute(
    sql`select * from claim_billing_reconciliations(${token}::uuid,10)`,
  );
  return result.rows.map((row) => ({
    userId: String(row.user_id),
    reconciliationId: String(row.reconciliation_id),
  }));
}
export async function failBillingReconciliation(userId: string, token: string) {
  await db().execute(
    sql`select fail_billing_reconciliation(${userId},${token}::uuid)`,
  );
}
export async function reconcileBilling(
  userId: string,
  token: string,
  reconciliationId: string,
) {
  const claim = await db().execute(
    sql`select * from begin_billing_reconciliation(${userId},${token}::uuid,${reconciliationId}::uuid)`,
  );
  const owner = claim.rows[0];
  if (!owner) return { result: "lease_lost" };
  if (owner.already_completed) return { result: "duplicate" };
  const client = stripe();
  const customerId = String(owner.customer_id);
  const all = new Map<string, Stripe.Subscription>();
  let after: string | undefined;
  let complete = false;
  for (let page = 0; page < 3; page++) {
    const response = await client.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
      ...(after ? { starting_after: after } : {}),
    });
    for (const item of response.data) {
      if (item.metadata.userId === userId) {
        if (
          (typeof item.customer === "string"
            ? item.customer
            : item.customer.id) !== customerId
        )
          throw new Error("Stripe customer scope changed");
        all.set(item.id, item);
      }
    }
    if (!response.has_more) {
      complete = true;
      break;
    }
    const next = response.data.at(-1)?.id;
    if (!next || next === after)
      throw new Error("Stripe pagination did not advance");
    after = next;
  }
  if (!complete)
    throw new Error("Stripe subscription history exceeds scan budget");
  const checkOwner = (sub: Stripe.Subscription) => {
    if (
      sub.metadata.userId !== userId ||
      (typeof sub.customer === "string" ? sub.customer : sub.customer.id) !==
        customerId
    )
      throw new Error("Stripe subscription ownership changed");
  };
  let current: Stripe.Subscription | undefined;
  if (owner.current_subscription_id) {
    current = await client.subscriptions.retrieve(
      String(owner.current_subscription_id),
    );
    checkOwner(current);
    all.set(current.id, current);
  }
  const usable = (sub: Stripe.Subscription) =>
    ["active", "trialing"].includes(sub.status);
  if ([...all.values()].filter(usable).length > 1)
    throw new Error("Multiple active subscriptions require review");
  const candidates = [...all.values()].filter(
    (sub) =>
      !current ||
      sub.id === current.id ||
      sub.created > current.created ||
      (sub.created === current.created &&
        ["canceled", "incomplete_expired"].includes(current.status) &&
        usable(sub)),
  );
  candidates.sort(
    (a, b) =>
      Number(usable(b)) - Number(usable(a)) ||
      b.created - a.created ||
      a.id.localeCompare(b.id),
  );
  let result;
  if (!candidates.length) {
    result = await db().execute(
      sql`select complete_empty_billing_reconciliation(${userId},${token}::uuid,${reconciliationId}::uuid,${String(owner.generation)}::bigint) as result`,
    );
  } else {
    const sub =
      current?.id === candidates[0].id
        ? current
        : await client.subscriptions.retrieve(candidates[0].id);
    checkOwner(sub);
    const snapshot = subscriptionSnapshot(sub);
    if (usable(sub) && snapshot.plan === "free")
      throw new Error("Active Stripe price is not configured");
    result = await db().execute(
      sql`select apply_subscription_observation(${userId},null,'reconciliation',null,${String(owner.generation)}::bigint,${JSON.stringify(snapshot)}::jsonb,${current ? new Date(current.created * 1000).toISOString() : null}::timestamptz,${current?.status || null},${reconciliationId}::uuid,${token}::uuid) as result`,
    );
  }
  const outcome = String(result.rows[0]?.result);
  if (outcome === "superseded")
    throw new Error("Reconciliation superseded; retry required");
  return { result: outcome };
}
export async function billingReconciliationHealth() {
  return (
    await db().execute(
      sql`select count(*) filter(where customer_id is not null) as tracked,count(*) filter(where customer_id is not null and reconciled_at is null) as never,count(*) filter(where customer_id is not null and reconciliation_next_at<=now()) as due,count(*) filter(where reconciliation_error is not null) as errors,min(reconciled_at)::text as oldest_success from subscriptions`,
    )
  ).rows[0];
}
export async function recentBillingReconciliationErrors() {
  return (
    await db().execute(
      sql`select user_id,reconciliation_error,reconciliation_failures,reconciliation_next_at::text as next_at from subscriptions where reconciliation_error is not null order by reconciliation_next_at,user_id limit 10`,
    )
  ).rows;
}
