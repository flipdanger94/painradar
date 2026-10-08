import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFileSync, readdirSync } from "node:fs";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type Stripe from "stripe";
const state = vi.hoisted(() => ({
  pg: undefined as PGlite | undefined,
  list: vi.fn(),
  retrieve: vi.fn(),
  createCustomer: vi.fn(),
}));
vi.mock("@/db", () => ({
  db: () => ({
    execute: async (q: SQL) => {
      const p = new PgDialect().sqlToQuery(q);
      return state.pg!.query(p.sql, p.params);
    },
  }),
}));
vi.mock("@/lib/stripe", () => ({
  stripe: () => ({
    subscriptions: { list: state.list, retrieve: state.retrieve },
    customers: { create: state.createCustomer },
  }),
}));
import {
  ensureBillingCustomer,
  claimBillingReconciliations,
  reconcileBilling,
  failBillingReconciliation,
  billingReconciliationHealth,
} from "@/lib/billing-reconciliation";
const pg = () => state.pg!;
const token = "a0000000-0000-4000-8000-000000000001";
const otherToken = "a0000000-0000-4000-8000-000000000002";
async function user(id = "fixture", customer: string | null = "cus_fixture") {
  await pg().query("insert into users(id,name,email) values($1,'Fixture',$2)", [
    id,
    id + "@example.test",
  ]);
  await pg().query(
    "insert into subscriptions(user_id,customer_id) values($1,$2)",
    [id, customer],
  );
}
function sub(
  id = "sub_fixture",
  status = "active",
  created = 1767225600,
  userId = "fixture",
  customer = "cus_fixture",
) {
  return {
    id,
    status,
    created,
    customer,
    metadata: { userId },
    cancel_at_period_end: false,
    items: {
      data: [
        { price: { id: "price_fixture" }, current_period_end: 1893456000 },
      ],
    },
  } as unknown as Stripe.Subscription;
}
async function projection(s: Stripe.Subscription) {
  await pg().query(
    "update subscriptions set subscription_id=$1,plan='pro',status=$2,provider_created_at=to_timestamp($3) where user_id='fixture'",
    [s.id, s.status, s.created],
  );
}
async function work() {
  return (await claimBillingReconciliations(token))[0];
}
beforeAll(async () => {
  state.pg = new PGlite({ extensions: { vector } });
  for (const f of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg().exec(readFileSync("drizzle/" + f, "utf8"));
});
beforeEach(async () => {
  await pg().exec("delete from users; delete from webhook_events");
  vi.resetAllMocks();
  process.env.STRIPE_PRICE_PRO = "price_fixture";
});
afterAll(async () => pg().close());
describe("Bounded Stripe reconciliation on PostgreSQL", () => {
  it("persists the first customer without granting paid access and reuses it", async () => {
    await user("fixture", null);
    state.createCustomer.mockResolvedValue({ id: "cus_fixture" });
    expect(await ensureBillingCustomer("fixture")).toBe("cus_fixture");
    expect(await ensureBillingCustomer("fixture")).toBe("cus_fixture");
    expect(state.createCustomer).toHaveBeenCalledTimes(1);
    expect(state.createCustomer.mock.calls[0][0]).toEqual({
      metadata: { userId: "fixture" },
    });
    expect(state.createCustomer.mock.calls[0][1].idempotencyKey).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(
      (
        await pg().query<{ plan: string; status: string }>(
          "select plan,status from subscriptions",
        )
      ).rows[0],
    ).toEqual({ plan: "free", status: "inactive" });
  });
  it("keeps the canonical customer under a racing registration and rejects cross-user assignment", async () => {
    await user();
    await user("other", null);
    expect(
      (
        await pg().query<{ id: string }>(
          "select register_billing_customer('fixture','cus_extra') as id",
        )
      ).rows[0].id,
    ).toBe("cus_fixture");
    await expect(
      pg().query("select register_billing_customer('other','cus_fixture')"),
    ).rejects.toThrow();
  });
  it("claims at most ten due known customers and fences an expired lease", async () => {
    for (let i = 0; i < 12; i++) await user("u" + i, "cus_" + i);
    await user("unknown", null);
    const first = await claimBillingReconciliations(token);
    expect(first).toHaveLength(10);
    expect(await claimBillingReconciliations(otherToken)).toHaveLength(2);
    const id = first[0].userId;
    await pg().query(
      "update subscriptions set reconciliation_lease_until=now()-interval '1 minute' where user_id=$1",
      [id],
    );
    expect((await claimBillingReconciliations(otherToken))[0].userId).toBe(id);
    expect(
      await reconcileBilling(id, token, first[0].reconciliationId),
    ).toEqual({ result: "lease_lost" });
    expect(state.list).not.toHaveBeenCalled();
  });
  it("recovers a first payment even if no subscription webhook was received", async () => {
    await user();
    const account = await work();
    state.list.mockResolvedValue({ data: [sub()], has_more: false });
    state.retrieve.mockResolvedValue(sub());
    expect(
      await reconcileBilling(account.userId, token, account.reconciliationId),
    ).toEqual({ result: "started" });
    expect(
      (
        await pg().query<{ plan: string; status: string }>(
          "select plan,status from subscriptions",
        )
      ).rows[0],
    ).toEqual({ plan: "pro", status: "active" });
    const history = (
      await pg().query<{
        event_id: string | null;
        event_type: string;
        reconciliation_id: string;
      }>(
        "select event_id,event_type,reconciliation_id from subscription_history",
      )
    ).rows[0];
    expect(history).toEqual({
      event_id: null,
      event_type: "reconciliation",
      reconciliation_id: account.reconciliationId,
    });
    expect(
      (await pg().query("select * from webhook_events")).rows,
    ).toHaveLength(0);
    expect(
      await reconcileBilling(account.userId, token, account.reconciliationId),
    ).toEqual({ result: "duplicate" });
    expect(state.list).toHaveBeenCalledTimes(1);
    expect(await claimBillingReconciliations(otherToken)).toHaveLength(0);
  });
  it("recovers a missed cancellation and does not use stale listing status", async () => {
    await user();
    await projection(sub());
    const account = await work();
    state.list.mockResolvedValue({ data: [sub()], has_more: false });
    state.retrieve.mockResolvedValue(sub(undefined, "canceled"));
    expect(
      await reconcileBilling(account.userId, token, account.reconciliationId),
    ).toEqual({ result: "ended" });
    expect(
      (await pg().query<{ status: string }>("select status from subscriptions"))
        .rows[0].status,
    ).toBe("canceled");
  });
  it("does not let reconciliation overwrite a newer webhook synchronization", async () => {
    await user();
    await projection(sub());
    const account = await work();
    state.list.mockImplementation(async () => {
      await pg().query(
        "select * from begin_subscription_sync('fixture','evt_newer')",
      );
      return { data: [sub()], has_more: false };
    });
    state.retrieve.mockResolvedValue(sub(undefined, "canceled"));
    await expect(
      reconcileBilling(account.userId, token, account.reconciliationId),
    ).rejects.toThrow("superseded");
    expect(
      (await pg().query<{ status: string }>("select status from subscriptions"))
        .rows[0].status,
    ).toBe("active");
    expect(
      (await pg().query("select * from subscription_history")).rows,
    ).toHaveLength(0);
  });
  it("confirms an empty customer without inventing a provider event or payment", async () => {
    await user();
    const account = await work();
    state.list.mockResolvedValue({ data: [], has_more: false });
    expect(
      await reconcileBilling(account.userId, token, account.reconciliationId),
    ).toEqual({ result: "empty" });
    expect(
      (
        await pg().query<{ transition: string; is_paid: boolean }>(
          "select transition,is_paid from subscription_history",
        )
      ).rows[0],
    ).toEqual({ transition: "reconciled_empty", is_paid: false });
    expect(
      await reconcileBilling(account.userId, token, account.reconciliationId),
    ).toEqual({ result: "duplicate" });
    expect(
      (await pg().query("select * from webhook_events")).rows,
    ).toHaveLength(0);
  });
  it("excludes another account metadata and rejects a changed customer scope", async () => {
    await user();
    let account = await work();
    state.list.mockResolvedValue({
      data: [sub(undefined, undefined, undefined, "other")],
      has_more: false,
    });
    expect(
      await reconcileBilling(account.userId, token, account.reconciliationId),
    ).toEqual({ result: "empty" });
    await pg().exec("update subscriptions set reconciliation_next_at=now()");
    account = await work();
    state.list.mockResolvedValue({
      data: [sub(undefined, undefined, undefined, undefined, "cus_other")],
      has_more: false,
    });
    await expect(
      reconcileBilling(account.userId, token, account.reconciliationId),
    ).rejects.toThrow("scope");
  });
  it("paginates customer-scoped history and restores a newer subscription", async () => {
    await user();
    await projection(sub("sub_old", "canceled"));
    const account = await work();
    state.list
      .mockResolvedValueOnce({
        data: [sub("sub_old", "canceled")],
        has_more: true,
      })
      .mockResolvedValueOnce({
        data: [sub("sub_new", "active", 1769904000)],
        has_more: false,
      });
    state.retrieve.mockImplementation(async (id: string) =>
      id === "sub_old"
        ? sub("sub_old", "canceled")
        : sub("sub_new", "active", 1769904000),
    );
    expect(
      await reconcileBilling(account.userId, token, account.reconciliationId),
    ).toEqual({ result: "started" });
    expect(state.list).toHaveBeenNthCalledWith(2, {
      customer: "cus_fixture",
      status: "all",
      limit: 100,
      starting_after: "sub_old",
    });
    expect(
      (
        await pg().query<{ subscription_id: string }>(
          "select subscription_id from subscriptions",
        )
      ).rows[0].subscription_id,
    ).toBe("sub_new");
  });
  it("stops at three pages without claiming complete reconciliation", async () => {
    await user();
    const account = await work();
    let page = 0;
    state.list.mockImplementation(async () => ({
      data: [sub("sub_" + ++page, "canceled")],
      has_more: true,
    }));
    await expect(
      reconcileBilling(account.userId, token, account.reconciliationId),
    ).rejects.toThrow("budget");
    expect(state.list).toHaveBeenCalledTimes(3);
    expect(
      (
        await pg().query<{ reconciled_at: unknown }>(
          "select reconciled_at from subscriptions",
        )
      ).rows[0].reconciled_at,
    ).toBeNull();
  });
  it("requires review for multiple usable subscriptions without changing access", async () => {
    await user();
    await projection(sub("sub_old"));
    const account = await work();
    state.list.mockResolvedValue({
      data: [sub("sub_old"), sub("sub_new", "active", 1769904000)],
      has_more: false,
    });
    state.retrieve.mockResolvedValue(sub("sub_old"));
    await expect(
      reconcileBilling(account.userId, token, account.reconciliationId),
    ).rejects.toThrow("Multiple active");
    expect(
      (
        await pg().query<{ subscription_id: string }>(
          "select subscription_id from subscriptions",
        )
      ).rows[0].subscription_id,
    ).toBe("sub_old");
  });
  it("does not downgrade an active account when its Stripe price configuration is missing", async () => {
    await user();
    await projection(sub());
    const account = await work();
    delete process.env.STRIPE_PRICE_PRO;
    state.list.mockResolvedValue({ data: [sub()], has_more: false });
    state.retrieve.mockResolvedValue(sub());
    await expect(
      reconcileBilling(account.userId, token, account.reconciliationId),
    ).rejects.toThrow("price is not configured");
    expect(
      (await pg().query<{ plan: string }>("select plan from subscriptions"))
        .rows[0].plan,
    ).toBe("pro");
    expect(
      (await pg().query("select * from subscription_history")).rows,
    ).toHaveLength(0);
  });
  it("releases failed work with backoff and prevents an old owner from clearing a new lease", async () => {
    await user();
    const account = await work();
    state.list.mockRejectedValue(new Error("Unavailable"));
    await expect(
      reconcileBilling(account.userId, token, account.reconciliationId),
    ).rejects.toThrow("Unavailable");
    await failBillingReconciliation(account.userId, token);
    expect(await claimBillingReconciliations(otherToken)).toHaveLength(0);
    expect(Number((await billingReconciliationHealth()).errors)).toBe(1);
    await pg().exec("update subscriptions set reconciliation_next_at=now()");
    await claimBillingReconciliations(otherToken);
    await failBillingReconciliation(account.userId, token);
    expect(
      (
        await pg().query<{ reconciliation_lease_token: string }>(
          "select reconciliation_lease_token from subscriptions",
        )
      ).rows[0].reconciliation_lease_token,
    ).toBe(otherToken);
    await pg().exec("update subscriptions set reconciliation_failures=12");
    await failBillingReconciliation(account.userId, otherToken);
    const wait = Number(
      (
        await pg().query<{ minutes: string }>(
          "select extract(epoch from (reconciliation_next_at-now()))/60 as minutes from subscriptions",
        )
      ).rows[0].minutes,
    );
    expect(wait).toBeGreaterThan(359);
    expect(wait).toBeLessThanOrEqual(360);
  });
});
