import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFileSync, readdirSync } from "node:fs";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type Stripe from "stripe";
const state = vi.hoisted(() => ({
  pg: undefined as PGlite | undefined,
  retrieve: vi.fn(),
}));
vi.mock("@/db", () => ({
  db: () => ({
    execute: async (q: SQL) => {
      const query = new PgDialect().sqlToQuery(q);
      return state.pg!.query(query.sql, query.params);
    },
  }),
}));
vi.mock("@/lib/stripe", () => ({
  stripe: () => ({ subscriptions: { retrieve: state.retrieve } }),
}));
import {
  synchronizeSubscription,
  billingMetrics,
  recentSubscriptionHistory,
} from "@/lib/billing-history";
const pg = () => state.pg!;
async function user(id: string) {
  await pg().query<Record<string, unknown>>(
    "insert into users(id,name,email) values($1,'Fixture',$2)",
    [id, id + "@example.test"],
  );
}
async function begin(id: string, event: string) {
  return (
    await pg().query<{
      generation: number;
      current_subscription_id: string | null;
    }>("select * from begin_subscription_sync($1,$2)", [id, event])
  ).rows[0];
}
function snapshot(
  id: string,
  status = "active",
  created = "2026-01-01T00:00:00Z",
  plan = "pro",
  cancel = false,
) {
  return {
    id,
    customerId: "customer-" + id.split("_")[0],
    createdAt: created,
    plan,
    status,
    cancelAtPeriodEnd: cancel,
    periodEnd: null,
  };
}
async function apply(
  id: string,
  event: string,
  generation: number,
  s: ReturnType<typeof snapshot>,
  existingCreated: string | null = null,
  existingStatus: string | null = null,
) {
  return (
    await pg().query<{ result: string }>(
      "select apply_subscription_sync($1,$2,'customer.subscription.updated',now(),$3,$4::jsonb,$5::timestamptz,$6) as result",
      [
        id,
        event,
        generation,
        JSON.stringify(s),
        existingCreated,
        existingStatus,
      ],
    )
  ).rows[0].result;
}
beforeAll(async () => {
  state.pg = new PGlite({ extensions: { vector } });
  const migrations = readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of migrations.filter((f) => f < "0013"))
    await pg().exec(readFileSync("drizzle/" + f, "utf8"));
  await user("legacy");
  await user("trial");
  await pg().exec(
    "insert into subscriptions(user_id,subscription_id,plan,status) values('legacy','legacy_old','pro','active'),('trial','trial_old','founder','trialing')",
  );
  for (const f of migrations.filter((f) => f >= "0013"))
    await pg().exec(readFileSync("drizzle/" + f, "utf8"));
});
afterAll(async () => pg().close());
describe("Atomic Stripe synchronization and observed metrics", () => {
  it("captures an honest baseline without inventing provider creation dates", async () => {
    const rows = (
      await pg().query<{ user_id: string; is_paid: boolean }>(
        "select user_id,is_paid from subscription_history where transition='baseline' order by user_id",
      )
    ).rows;
    expect(rows).toEqual([
      { user_id: "legacy", is_paid: true },
      { user_id: "trial", is_paid: false },
    ]);
    expect((await billingMetrics()).churn_percent).toBeNull();
    expect(
      (
        await pg().query<Record<string, unknown>>(
          "select provider_created_at from subscriptions where user_id='legacy'",
        )
      ).rows[0].provider_created_at,
    ).toBeNull();
  });
  it("commits projection, event and history once", async () => {
    await user("once");
    const owner = await begin("once", "evt_once");
    expect(
      await apply("once", "evt_once", owner.generation, snapshot("once_old")),
    ).toBe("started");
    expect(
      await apply(
        "once",
        "evt_once",
        owner.generation,
        snapshot("once_old", "canceled"),
      ),
    ).toBe("duplicate");
    expect(await begin("once", "evt_once")).toBeUndefined();
    expect(
      (
        await pg().query<Record<string, unknown>>(
          "select status from subscriptions where user_id='once'",
        )
      ).rows[0].status,
    ).toBe("active");
    expect(
      (
        await pg().query<Record<string, unknown>>(
          "select id from subscription_history where event_id='evt_once'",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("fences a slow earlier fetch even when event timestamps share a second", async () => {
    await user("race");
    const first = await begin("race", "evt_race1");
    const second = await begin("race", "evt_race2");
    expect(
      await apply(
        "race",
        "evt_race2",
        second.generation,
        snapshot("race_old", "active", undefined, "founder"),
      ),
    ).toBe("started");
    expect(
      await apply(
        "race",
        "evt_race1",
        first.generation,
        snapshot("race_old", "canceled"),
      ),
    ).toBe("superseded");
    expect(
      (
        await pg().query<Record<string, unknown>>(
          "select plan,status from subscriptions where user_id='race'",
        )
      ).rows[0],
    ).toEqual({ plan: "founder", status: "active" });
    expect(
      (
        await pg().query<Record<string, unknown>>(
          "select id from webhook_events where id='evt_race1'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("keeps a replacement subscription when an old cancellation arrives late", async () => {
    await user("replace");
    let owner = await begin("replace", "evt_replace1");
    await apply(
      "replace",
      "evt_replace1",
      owner.generation,
      snapshot("replace_old"),
    );
    owner = await begin("replace", "evt_replace2");
    await apply(
      "replace",
      "evt_replace2",
      owner.generation,
      snapshot("replace_new", "active", "2026-02-01T00:00:00Z", "agency"),
    );
    owner = await begin("replace", "evt_replace3");
    expect(
      await apply(
        "replace",
        "evt_replace3",
        owner.generation,
        snapshot("replace_old", "canceled"),
      ),
    ).toBe("older_or_ambiguous_subscription");
    expect(
      (
        await pg().query<Record<string, unknown>>(
          "select subscription_id,plan from subscriptions where user_id='replace'",
        )
      ).rows[0],
    ).toEqual({ subscription_id: "replace_new", plan: "agency" });
  });
  it("does not consume a duplicate event while a newer synchronization owns it", async () => {
    await user("duplicate_race");
    const first = await begin("duplicate_race", "evt_duplicate_race");
    const second = await begin("duplicate_race", "evt_duplicate_race");
    expect(
      await apply(
        "duplicate_race",
        "evt_duplicate_race",
        first.generation,
        snapshot("duplicateRace_old", "canceled"),
      ),
    ).toBe("superseded");
    expect(
      (
        await pg().query<Record<string, unknown>>(
          "select id from webhook_events where id='evt_duplicate_race'",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      await apply(
        "duplicate_race",
        "evt_duplicate_race",
        second.generation,
        snapshot("duplicateRace_old"),
      ),
    ).toBe("started");
    expect(
      (
        await pg().query<Record<string, unknown>>(
          "select status from subscriptions where user_id='duplicate_race'",
        )
      ).rows[0].status,
    ).toBe("active");
  });
  it("retrieves the legacy current subscription before allowing a replacement", async () => {
    await user("legacy_handler");
    await pg().query<Record<string, unknown>>(
      "insert into subscriptions(user_id,subscription_id,customer_id,plan,status) values('legacy_handler','lh_current','cus_lh','founder','active')",
    );
    state.retrieve.mockReset().mockImplementation(async (id: string) => ({
      id,
      metadata: { userId: "legacy_handler" },
      created: id === "lh_current" ? 1767225600 : 1735689600,
      customer: "cus_lh",
      status: id === "lh_current" ? "active" : "canceled",
      cancel_at_period_end: false,
      items: { data: [{ price: { id: "price_lh" } }] },
    }));
    const event = {
      id: "evt_lh",
      created: 1791280000,
      type: "customer.subscription.deleted",
      data: {
        object: { id: "lh_old", metadata: { userId: "legacy_handler" } },
      },
    } as unknown as Stripe.Event;
    expect(await synchronizeSubscription(event)).toBe(
      "older_or_ambiguous_subscription",
    );
    expect(state.retrieve).toHaveBeenNthCalledWith(1, "lh_old");
    expect(state.retrieve).toHaveBeenNthCalledWith(2, "lh_current");
    expect(
      (
        await pg().query<Record<string, unknown>>(
          "select subscription_id from subscriptions where user_id='legacy_handler'",
        )
      ).rows[0].subscription_id,
    ).toBe("lh_current");
    state.retrieve.mockReset();
  });
  it("protects a legacy projection using retrieved creation time", async () => {
    const owner = await begin("legacy", "evt_legacy_old");
    expect(
      await apply(
        "legacy",
        "evt_legacy_old",
        owner.generation,
        snapshot("legacy_older", "canceled", "2025-01-01T00:00:00Z"),
        "2026-01-01T00:00:00Z",
        "active",
      ),
    ).toBe("older_or_ambiguous_subscription");
  });
  it("does not displace an active subscription with a newer unfinished checkout", async () => {
    await user("pending_checkout");
    let owner = await begin("pending_checkout", "evt_pending_old");
    await apply(
      "pending_checkout",
      "evt_pending_old",
      owner.generation,
      snapshot("pendingCheckout_old"),
    );
    owner = await begin("pending_checkout", "evt_pending_new");
    expect(
      await apply(
        "pending_checkout",
        "evt_pending_new",
        owner.generation,
        snapshot("pendingCheckout_new", "incomplete", "2026-02-01T00:00:00Z"),
        null,
        "active",
      ),
    ).toBe("older_or_ambiguous_subscription");
    expect(
      (
        await pg().query<Record<string, unknown>>(
          "select subscription_id,status from subscriptions where user_id='pending_checkout'",
        )
      ).rows[0],
    ).toEqual({ subscription_id: "pendingCheckout_old", status: "active" });
  });
  it("allows a same-second replacement only when the current subscription has ended", async () => {
    await user("same");
    let owner = await begin("same", "evt_same1");
    await apply(
      "same",
      "evt_same1",
      owner.generation,
      snapshot("same_old", "canceled"),
    );
    owner = await begin("same", "evt_same2");
    expect(
      await apply(
        "same",
        "evt_same2",
        owner.generation,
        snapshot("same_new"),
        undefined,
        "canceled",
      ),
    ).toBe("started");
    owner = await begin("same", "evt_same3");
    expect(
      await apply(
        "same",
        "evt_same3",
        owner.generation,
        snapshot("same_other"),
        undefined,
        "active",
      ),
    ).toBe("older_or_ambiguous_subscription");
  });
  it("distinguishes scheduling from an actual active-status loss and recovery", async () => {
    await user("schedule");
    let owner = await begin("schedule", "evt_schedule1");
    await apply(
      "schedule",
      "evt_schedule1",
      owner.generation,
      snapshot("schedule_old"),
    );
    owner = await begin("schedule", "evt_schedule2");
    expect(
      await apply(
        "schedule",
        "evt_schedule2",
        owner.generation,
        snapshot("schedule_old", "active", undefined, "pro", true),
      ),
    ).toBe("cancellation_scheduled");
    owner = await begin("schedule", "evt_schedule3");
    expect(
      await apply(
        "schedule",
        "evt_schedule3",
        owner.generation,
        snapshot("schedule_old", "past_due"),
      ),
    ).toBe("ended");
    owner = await begin("schedule", "evt_schedule4");
    expect(
      await apply(
        "schedule",
        "evt_schedule4",
        owner.generation,
        snapshot("schedule_old"),
      ),
    ).toBe("started");
  });
  it("rolls back the event and history if projection integrity fails", async () => {
    await user("rollback");
    const owner = await begin("rollback", "evt_rollback");
    await expect(
      apply("rollback", "evt_rollback", owner.generation, {
        ...snapshot("rollback_old"),
        customerId: "customer-once",
      }),
    ).rejects.toThrow();
    expect(
      (
        await pg().query<Record<string, unknown>>(
          "select id from webhook_events where id='evt_rollback'",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await pg().query<Record<string, unknown>>(
          "select id from subscription_history where event_id='evt_rollback'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("executes the production handler with fresh Stripe retrieval, not a stale event payload", async () => {
    await user("handler");
    process.env.STRIPE_PRICE_PRO = "price_test";
    state.retrieve.mockResolvedValue({
      id: "handler_old",
      metadata: { userId: "handler" },
      created: 1767225600,
      customer: "cus_handler",
      status: "active",
      cancel_at_period_end: false,
      items: {
        data: [{ price: { id: "price_test" }, current_period_end: 1798761600 }],
      },
    });
    const event = {
      id: "evt_handler",
      created: 1791280000,
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "handler_old",
          metadata: { userId: "handler" },
          status: "canceled",
        },
      },
    } as unknown as Stripe.Event;
    expect(await synchronizeSubscription(event)).toBe("started");
    expect(await synchronizeSubscription(event)).toBe("duplicate");
    expect(state.retrieve).toHaveBeenCalledTimes(1);
    expect(
      (
        await pg().query<Record<string, unknown>>(
          "select status from subscriptions where user_id='handler'",
        )
      ).rows[0].status,
    ).toBe("active");
    expect((await recentSubscriptionHistory()).length).toBeGreaterThan(0);
  });
  it("does not claim an event when the provider request fails, allowing retry", async () => {
    await user("retry");
    state.retrieve.mockRejectedValue(new Error("Provider unavailable"));
    const event = {
      id: "evt_retry",
      created: 1791280000,
      type: "customer.subscription.updated",
      data: { object: { id: "retry_old", metadata: { userId: "retry" } } },
    } as unknown as Stripe.Event;
    await expect(synchronizeSubscription(event)).rejects.toThrow(
      "Provider unavailable",
    );
    expect(
      (
        await pg().query<Record<string, unknown>>(
          "select id from webhook_events where id='evt_retry'",
        )
      ).rows,
    ).toHaveLength(0);
    expect(await begin("retry", "evt_retry")).toBeDefined();
  });
  it("computes cohort losses once and returns unknown until a full window is tracked", async () => {
    await pg().exec("delete from subscription_history");
    await pg().exec(
      "update billing_observation set started_at='2026-01-01T00:00:00Z'",
    );
    for (const id of ["cohort_a", "cohort_b", "new_paid", "unknown_price"])
      await user(id);
    const history = async (
      id: string,
      date: string,
      was: boolean,
      next: boolean,
      applied = true,
    ) =>
      pg().query<Record<string, unknown>>(
        "insert into subscription_history(user_id,event_type,observed_at,plan,status,cancel_at_period_end,applied,transition,was_paid,is_paid) values($1,'fixture',$2,'pro','active',false,$3,'fixture',$4,$5)",
        [id, date, applied, was, next],
      );
    await history("cohort_a", "2026-01-01", false, true);
    await history("cohort_b", "2026-01-01", false, true);
    await history("unknown_price", "2026-01-01", false, false);
    await history("cohort_a", "2026-02-02", true, false);
    await history("cohort_a", "2026-02-03", false, true);
    await history("cohort_a", "2026-02-04", true, false);
    await history("cohort_b", "2026-02-03", true, false, false);
    await history("new_paid", "2026-02-02", false, true);
    await history("new_paid", "2026-02-04", true, false);
    const metrics = (
      await pg().query<{
        cohort_accounts: number;
        lost_cohort_accounts: number;
        churn_percent: string;
        observed_losses: number;
      }>("select * from billing_metrics('2026-03-01T00:00:00Z')")
    ).rows[0];
    expect(Number(metrics.cohort_accounts)).toBe(2);
    expect(Number(metrics.lost_cohort_accounts)).toBe(1);
    expect(Number(metrics.churn_percent)).toBe(50);
    expect(Number(metrics.observed_losses)).toBe(2);
    expect(
      (
        await pg().query<Record<string, unknown>>(
          "select * from billing_metrics('2026-01-15T00:00:00Z')",
        )
      ).rows[0].churn_percent,
    ).toBeNull();
  });
});
