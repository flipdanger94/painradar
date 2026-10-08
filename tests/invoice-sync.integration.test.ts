import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFileSync, readdirSync } from "node:fs";
import { PgDialect } from "drizzle-orm/pg-core";
import { type SQL } from "drizzle-orm";
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
  stripe: () => ({ invoices: { retrieve: state.retrieve } }),
}));
import { synchronizeInvoice } from "@/lib/invoice-sync";
const event = (
  id = "evt_1",
  type = "invoice.payment_failed",
  customer: unknown = "cus_1",
  invoiceId = "in_1",
) =>
  ({
    id,
    type,
    created: 1770000000,
    data: {
      object: { id: invoiceId, customer, status: "open", amount_paid: 0 },
    },
  }) as unknown as Stripe.Event;
const fresh = (overrides: Record<string, unknown> = {}) => ({
  id: "in_1",
  customer: "cus_1",
  created: 1760000000,
  status: "paid",
  amount_paid: 2900,
  currency: "usd",
  hosted_invoice_url: "https://invoice.stripe.com/i/fixture",
  ...overrides,
});
async function count(table: string) {
  if (!["invoices", "webhook_events", "invoice_sync_state"].includes(table))
    throw new Error("Test table whitelist");
  return Number(
    (
      await state.pg!.query<{ count: number }>(
        `select count(*) as count from ${table}`,
      )
    ).rows[0].count,
  );
}
beforeAll(async () => {
  state.pg = new PGlite({ extensions: { vector } });
  for (const f of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await state.pg.exec(readFileSync("drizzle/" + f, "utf8"));
  await state.pg.exec(
    "insert into users(id,name,email,email_verified) values('u1','Fixture','u1@example.test',true),('u2','Fixture','u2@example.test',true); insert into subscriptions(user_id,customer_id,plan,status) values('u1','cus_1','pro','active'),('u2','cus_2','pro','active')",
  );
});
afterAll(async () => state.pg?.close());
beforeEach(async () => {
  state.retrieve.mockReset();
  state.retrieve.mockResolvedValue(fresh());
  await state.pg!.exec(
    "delete from invoices; delete from invoice_sync_state; delete from webhook_events",
  );
  await state.pg!.query(
    "update subscriptions set customer_id='cus_1' where user_id='u1'",
  );
});
describe("invoice provider synchronization", () => {
  it("records freshly retrieved paid state despite an old failure event", async () => {
    expect(await synchronizeInvoice(event())).toBe("applied");
    const row = (
      await state.pg!.query<Record<string, unknown>>("select * from invoices")
    ).rows[0];
    expect(row).toMatchObject({
      id: "in_1",
      customer_id: "cus_1",
      status: "paid",
      amount_paid: 2900,
      currency: "usd",
    });
    expect(row.provider_created_at).not.toBeNull();
    expect(row.observed_at).not.toBeNull();
  });
  it("skips completed event duplicates without another provider request", async () => {
    await synchronizeInvoice(event());
    state.retrieve.mockClear();
    expect(await synchronizeInvoice(event())).toBe("duplicate");
    expect(state.retrieve).not.toHaveBeenCalled();
    expect(await count("invoices")).toBe(1);
  });
  it("does not consume an event if retrieval fails and succeeds on retry", async () => {
    state.retrieve.mockRejectedValueOnce(new Error("Provider timeout"));
    await expect(synchronizeInvoice(event())).rejects.toThrow(/timeout/);
    expect(await count("webhook_events")).toBe(0);
    expect(await count("invoices")).toBe(0);
    expect(await synchronizeInvoice(event())).toBe("applied");
  });
  it("fences a slow older fetch after a newer generation, leaving its event retryable", async () => {
    let resolveOld!: (value: unknown) => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    state.retrieve.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => {
        resolveOld = resolve;
      });
    });
    const old = synchronizeInvoice(event("evt_old"));
    await ready;
    await synchronizeInvoice(event("evt_new", "invoice.paid"));
    resolveOld(fresh({ status: "open", amount_paid: 0 }));
    await expect(old).rejects.toThrow(/superseded/);
    expect(
      (await state.pg!.query<{ status: string }>("select status from invoices"))
        .rows[0].status,
    ).toBe("paid");
    expect(
      (
        await state.pg!.query(
          "select id from webhook_events where id='evt_old'",
        )
      ).rows,
    ).toHaveLength(0);
    expect(await synchronizeInvoice(event("evt_old"))).toBe("applied");
  });
  it("handles concurrent deliveries of the same event without downgrading a committed invoice", async () => {
    let resolveOld!: (value: unknown) => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    state.retrieve.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => {
        resolveOld = resolve;
      });
    });
    const old = synchronizeInvoice(event());
    await ready;
    await synchronizeInvoice(event());
    resolveOld(fresh({ status: "open", amount_paid: 0 }));
    expect(await old).toBe("duplicate");
    expect(await count("webhook_events")).toBe(1);
    expect(
      (await state.pg!.query<{ status: string }>("select status from invoices"))
        .rows[0].status,
    ).toBe("paid");
  });
  it("requires a known Customer before fetching or consuming its invoice", async () => {
    await expect(
      synchronizeInvoice(event("evt_unknown", "invoice.paid", "cus_unknown")),
    ).rejects.toThrow(/mapping/);
    expect(state.retrieve).not.toHaveBeenCalled();
    expect(await count("invoice_sync_state")).toBe(0);
    expect(await count("webhook_events")).toBe(0);
  });
  it("rejects fresh invoice or Customer identity mismatches", async () => {
    for (const overrides of [{ customer: "cus_2" }, { id: "in_other" }]) {
      state.retrieve.mockResolvedValueOnce(fresh(overrides));
      await expect(synchronizeInvoice(event())).rejects.toThrow(/scope/);
    }
    expect(await count("invoices")).toBe(0);
    expect(await count("webhook_events")).toBe(0);
  });
  it("does not let a second Customer claim an invoice belonging to another account", async () => {
    await synchronizeInvoice(event());
    state.retrieve.mockClear();
    await expect(
      synchronizeInvoice(event("evt_other", "invoice.paid", "cus_2")),
    ).rejects.toThrow(/mismatch/);
    expect(state.retrieve).not.toHaveBeenCalled();
    expect(await count("webhook_events")).toBe(1);
  });
  it("rechecks Customer mapping at commit after an account is disconnected", async () => {
    state.retrieve.mockImplementationOnce(async () => {
      await state.pg!.query(
        "update subscriptions set customer_id=NULL where user_id='u1'",
      );
      return fresh();
    });
    await expect(synchronizeInvoice(event())).rejects.toThrow(/mapping/);
    expect(await count("webhook_events")).toBe(0);
    expect(await count("invoices")).toBe(0);
  });
  it("validates amounts and hosted URL before committing provider data", async () => {
    for (const overrides of [
      { amount_paid: -1 },
      { amount_paid: 1.5 },
      { hosted_invoice_url: "javascript:alert(1)" },
      { currency: "invalid" },
    ]) {
      state.retrieve.mockResolvedValueOnce(fresh(overrides));
      await expect(synchronizeInvoice(event())).rejects.toThrow();
    }
    expect(await count("webhook_events")).toBe(0);
  });
  it("updates terminal invoice state, URL, currency and dates without changing subscription entitlement", async () => {
    await synchronizeInvoice(event());
    state.retrieve.mockResolvedValueOnce(
      fresh({
        status: "void",
        amount_paid: 0,
        currency: "eur",
        hosted_invoice_url: null,
      }),
    );
    await synchronizeInvoice(event("evt_void", "invoice.voided"));
    expect(
      (await state.pg!.query<Record<string, unknown>>("select * from invoices"))
        .rows[0],
    ).toMatchObject({ status: "void", currency: "eur", url: null });
    expect(
      (
        await state.pg!.query<{ plan: string; status: string }>(
          "select plan,status from subscriptions where user_id='u1'",
        )
      ).rows[0],
    ).toEqual({ plan: "pro", status: "active" });
  });
  it("keeps event and projection atomic on invalid SQL data", async () => {
    const generation = (
      await state.pg!.query<{ generation: string }>(
        "select begin_invoice_sync('in_1','cus_1','evt_bad') as generation",
      )
    ).rows[0].generation;
    await expect(
      state.pg!.query(
        "select apply_invoice_sync('in_1','cus_1','evt_bad',$1,$2::jsonb)",
        [
          generation,
          JSON.stringify({
            id: "in_1",
            customerId: "cus_1",
            amountPaid: null,
            currency: "usd",
            status: "paid",
            url: null,
            createdAt: new Date().toISOString(),
          }),
        ],
      ),
    ).rejects.toThrow();
    expect(await count("webhook_events")).toBe(0);
    expect(await count("invoices")).toBe(0);
  });
});
