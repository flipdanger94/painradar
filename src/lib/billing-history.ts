import { sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db } from "@/db";
import { stripe } from "./stripe";

export async function synchronizeSubscription(event: Stripe.Event) {
  const object = event.data.object as Stripe.Subscription;
  const userId = object.metadata?.userId;
  if (!userId) throw new Error("Subscription user metadata is missing");
  const claim = await db().execute(
    sql`select * from begin_subscription_sync(${userId},${event.id})`,
  );
  const owner = claim.rows[0];
  if (!owner) return "duplicate";
  const client = stripe();
  const sub = await client.subscriptions.retrieve(object.id);
  if (sub.metadata.userId !== userId)
    throw new Error("Subscription owner changed");
  let existing: Stripe.Subscription | undefined;
  if (
    owner.current_subscription_id &&
    owner.current_subscription_id !== sub.id
  ) {
    existing = await client.subscriptions.retrieve(
      String(owner.current_subscription_id),
    );
    if (existing.metadata.userId !== userId)
      throw new Error("Current subscription owner does not match");
  }
  const snapshot = subscriptionSnapshot(sub);
  const result = await db().execute(
    sql`select apply_subscription_sync(${userId},${event.id},${event.type},${new Date(event.created * 1000).toISOString()}::timestamptz,${String(owner.generation)}::bigint,${JSON.stringify(snapshot)}::jsonb,${existing ? new Date(existing.created * 1000).toISOString() : null}::timestamptz,${existing?.status || null}) as result`,
  );
  const outcome = String(result.rows[0]?.result);
  if (outcome === "superseded")
    throw new Error(
      "Subscription synchronization was superseded; retry required",
    );
  return outcome;
}

export function subscriptionSnapshot(sub: Stripe.Subscription) {
  const price = sub.items.data[0]?.price.id;
  const plan =
    price && price === process.env.STRIPE_PRICE_PRO
      ? "pro"
      : price && price === process.env.STRIPE_PRICE_FOUNDER
        ? "founder"
        : price && price === process.env.STRIPE_PRICE_AGENCY
          ? "agency"
          : "free";
  return {
    id: sub.id,
    customerId:
      typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    createdAt: new Date(sub.created * 1000).toISOString(),
    plan,
    status: sub.status,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    periodEnd: sub.items.data[0]?.current_period_end
      ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
      : null,
  };
}

export async function billingMetrics() {
  return (await db().execute(sql`select * from billing_metrics()`)).rows[0];
}
export async function recentSubscriptionHistory() {
  return (
    await db().execute(
      sql`select id,user_id,subscription_id,event_type,event_created_at,observed_at::text as observed_at,plan,status,applied,transition from subscription_history order by observed_at desc,generation desc limit 30`,
    )
  ).rows;
}
