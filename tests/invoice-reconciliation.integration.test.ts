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
  list: vi.fn(),
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
  stripe: () => ({ invoices: { list: state.list, retrieve: state.retrieve } }),
}));
import {
  claimInvoiceReconciliations,
  reconcileInvoices,
  failInvoiceReconciliation,
  invoiceReconciliationHealth,
  recentInvoiceReconciliationErrors,
} from "@/lib/invoice-reconciliation";
import { synchronizeInvoice } from "@/lib/invoice-sync";
const token = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const invoice = (id = "in_1", extras: Record<string, unknown> = {}) => ({
  id,
  customer: "cus_1",
  created: 1760000000,
  amount_paid: 2900,
  currency: "usd",
  status: "paid",
  hosted_invoice_url: null,
  ...extras,
});
const query = <T>(q: string, params: unknown[] = []) =>
  state.pg!.query<T>(q, params);
const queue = async () =>
  (
    await query<Record<string, unknown>>(
      "select * from invoice_reconciliation_queue where customer_id='cus_1'",
    )
  ).rows[0];
const due = () =>
  query(
    "update invoice_reconciliation_queue set next_at=now()-interval '1 minute'",
  );
beforeAll(async () => {
  state.pg = new PGlite({ extensions: { vector } });
  for (const f of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await state.pg.exec(readFileSync("drizzle/" + f, "utf8"));
  await state.pg.exec(
    "insert into users(id,name,email,email_verified) values('u1','Fixture','u1@example.test',true); insert into subscriptions(user_id,customer_id,plan,status) values('u1','cus_1','pro','active')",
  );
});
afterAll(async () => state.pg?.close());
beforeEach(async () => {
  state.list.mockReset();
  state.retrieve.mockReset();
  state.list.mockResolvedValue({
    data: [invoice("in_1", { status: "open", amount_paid: 0 })],
    has_more: false,
  });
  state.retrieve.mockImplementation(async (id: string) => invoice(id));
  await state.pg!.exec(
    "delete from invoice_reconciliation_queue; delete from invoices; delete from invoice_sync_state; delete from webhook_events; update subscriptions set customer_id='cus_1' where user_id='u1'",
  );
});
describe("bounded missed-invoice recovery", () => {
  it("restores a missed invoice from fresh GET without invented webhook markers or entitlement changes", async () => {
    expect(await claimInvoiceReconciliations(token)).toEqual([
      { customerId: "cus_1" },
    ]);
    expect(await reconcileInvoices("cus_1", token)).toEqual({
      result: "completed",
      processed: 1,
    });
    expect(
      (await query("select id,status,amount_paid from invoices")).rows,
    ).toEqual([{ id: "in_1", status: "paid", amount_paid: 2900 }]);
    expect((await query("select * from webhook_events")).rows).toHaveLength(0);
    expect(
      (await query("select plan,status from subscriptions")).rows[0],
    ).toEqual({ plan: "pro", status: "active" });
    expect((await queue()).completed_at).not.toBeNull();
    expect(await claimInvoiceReconciliations(other)).toEqual([]);
    expect(await reconcileInvoices("cus_1", token)).toEqual({
      result: "lease_lost",
      processed: 0,
    });
  });
  it("persists a frozen creation bound and cursor until all pages finish", async () => {
    await claimInvoiceReconciliations(token);
    const frozen = (await queue()).frozen_until;
    state.list.mockResolvedValueOnce({
      data: Array.from({ length: 10 }, (_, i) => invoice("in_" + i)),
      has_more: true,
    });
    expect(await reconcileInvoices("cus_1", token)).toEqual({
      result: "continued",
      processed: 10,
    });
    expect((await queue()).cursor).toBe("in_9");
    expect((await queue()).completed_at).toBeNull();
    await due();
    await claimInvoiceReconciliations(other);
    expect((await queue()).frozen_until).toEqual(frozen);
    await reconcileInvoices("cus_1", other);
    const first = state.list.mock.calls[0][0],
      second = state.list.mock.calls[1][0];
    expect(second).toEqual({ ...first, starting_after: "in_9" });
    expect(first.limit).toBe(10);
    expect(first.status).toBeUndefined();
    expect((await queue()).cursor).toBeNull();
    expect((await queue()).frozen_until).toBeNull();
  });
  it("keeps cursor unchanged after a mid-page provider failure and safely replays partial writes", async () => {
    await claimInvoiceReconciliations(token);
    state.list.mockResolvedValue({
      data: [invoice("in_1"), invoice("in_2")],
      has_more: true,
    });
    state.retrieve
      .mockResolvedValueOnce(invoice("in_1"))
      .mockRejectedValueOnce(new Error("Provider timeout"));
    await expect(reconcileInvoices("cus_1", token)).rejects.toThrow(/timeout/);
    expect((await queue()).cursor).toBeNull();
    expect((await queue()).completed_at).toBeNull();
    expect((await query("select * from invoices")).rows).toHaveLength(1);
    expect(await reconcileInvoices("cus_1", token)).toEqual({
      result: "continued",
      processed: 2,
    });
    expect((await query("select * from invoices")).rows).toHaveLength(2);
  });
  it("fences an older reconciliation GET after a newer webhook observation", async () => {
    await claimInvoiceReconciliations(token);
    let resolveOld!: (v: unknown) => void, started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    state.retrieve.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => {
        resolveOld = resolve;
      });
    });
    const old = reconcileInvoices("cus_1", token);
    await ready;
    await synchronizeInvoice({
      id: "evt_new",
      type: "invoice.paid",
      data: { object: invoice() },
    } as unknown as Stripe.Event);
    resolveOld(invoice("in_1", { status: "open", amount_paid: 0 }));
    await expect(old).rejects.toThrow(/superseded/);
    expect((await query("select status from invoices")).rows[0]).toEqual({
      status: "paid",
    });
    expect((await queue()).completed_at).toBeNull();
    await reconcileInvoices("cus_1", token);
    expect((await query("select * from webhook_events")).rows).toHaveLength(1);
  });
  it("fences a slow webhook after a newer reconciliation observation", async () => {
    await claimInvoiceReconciliations(token);
    let resolveOld!: (v: unknown) => void, started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    state.retrieve.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => {
        resolveOld = resolve;
      });
    });
    const old = synchronizeInvoice({
      id: "evt_old",
      type: "invoice.paid",
      data: { object: invoice() },
    } as unknown as Stripe.Event);
    await ready;
    await reconcileInvoices("cus_1", token);
    resolveOld(invoice("in_1", { status: "open", amount_paid: 0 }));
    await expect(old).rejects.toThrow(/superseded/);
    expect((await query("select status from invoices")).rows[0]).toEqual({
      status: "paid",
    });
    expect((await query("select * from webhook_events")).rows).toHaveLength(0);
  });
  it("rejects malformed, oversized, foreign, repeated, and empty continuation pages before GET", async () => {
    await claimInvoiceReconciliations(token);
    for (const page of [
      { data: [], has_more: true },
      { data: [invoice(), invoice()], has_more: false },
      { data: [invoice("in_1", { customer: "cus_other" })], has_more: false },
      {
        data: Array.from({ length: 11 }, (_, i) => invoice("in_" + i)),
        has_more: false,
      },
      {
        data: [invoice("in_future", { created: 9999999999 })],
        has_more: false,
      },
      { data: [invoice()], has_more: "yes" },
    ]) {
      state.list.mockResolvedValueOnce(page);
      await expect(reconcileInvoices("cus_1", token)).rejects.toThrow();
    }
    expect(state.retrieve).not.toHaveBeenCalled();
    expect((await queue()).completed_at).toBeNull();
  });
  it("does not advance a repeated checkpoint or a mismatched fresh identity", async () => {
    await claimInvoiceReconciliations(token);
    await query("update invoice_reconciliation_queue set cursor='in_1'");
    await expect(reconcileInvoices("cus_1", token)).rejects.toThrow(
      /pagination/,
    );
    await query("update invoice_reconciliation_queue set cursor=NULL");
    state.retrieve.mockResolvedValueOnce(invoice("in_other"));
    await expect(reconcileInvoices("cus_1", token)).rejects.toThrow(/scope/);
    expect((await query("select * from invoices")).rows).toHaveLength(0);
  });
  it("rejects lost ownership at commit and old owners cannot release a new lease", async () => {
    await claimInvoiceReconciliations(token);
    state.retrieve.mockImplementationOnce(async () => {
      await query(
        "update invoice_reconciliation_queue set lease_until=now()-interval '1 minute'",
      );
      await claimInvoiceReconciliations(other);
      return invoice();
    });
    await expect(reconcileInvoices("cus_1", token)).rejects.toThrow(/lease/);
    expect((await query("select * from invoices")).rows).toHaveLength(0);
    await failInvoiceReconciliation("cus_1", token);
    expect((await queue()).lease_token).toBe(other);
    expect((await queue()).failures).toBe(0);
  });
  it("compares the page cursor before finishing and cannot finish twice", async () => {
    await claimInvoiceReconciliations(token);
    expect(
      (
        await query(
          "select finish_invoice_reconciliation_page('cus_1',$1,'wrong','in_2',true) as result",
          [token],
        )
      ).rows[0],
    ).toEqual({ result: "lease_lost" });
    expect((await queue()).lease_token).toBe(token);
    await reconcileInvoices("cus_1", token);
    expect(
      (
        await query(
          "select finish_invoice_reconciliation_page('cus_1',$1,NULL,NULL,false) as result",
          [token],
        )
      ).rows[0],
    ).toEqual({ result: "lease_lost" });
  });
  it("completes an empty customer and ignores unknown Customers without provider calls", async () => {
    state.list.mockResolvedValue({ data: [], has_more: false });
    await claimInvoiceReconciliations(token);
    expect(await reconcileInvoices("cus_unknown", token)).toEqual({
      result: "lease_lost",
      processed: 0,
    });
    expect(state.list).not.toHaveBeenCalled();
    expect(await reconcileInvoices("cus_1", token)).toEqual({
      result: "completed",
      processed: 0,
    });
    expect(state.retrieve).not.toHaveBeenCalled();
  });
  it("retains scan position on exhaustion, backs off with a six-hour cap and exposes health", async () => {
    await claimInvoiceReconciliations(token);
    await query(
      "update invoice_reconciliation_queue set cursor='in_checkpoint',failures=7",
    );
    await failInvoiceReconciliation("cus_1", token);
    const row = await queue();
    expect(row.cursor).toBe("in_checkpoint");
    expect(row.failures).toBe(8);
    expect(row.lease_token).toBeNull();
    const minutes = Number(
      (
        await query<{ minutes: number }>(
          "select extract(epoch from next_at-clock_timestamp())/60 as minutes from invoice_reconciliation_queue",
        )
      ).rows[0].minutes,
    );
    expect(minutes).toBeGreaterThan(359);
    expect(minutes).toBeLessThanOrEqual(360);
    expect(await invoiceReconciliationHealth()).toMatchObject({
      tracked: 1,
      never: 1,
      continuing: 1,
      errors: 1,
    });
    expect(await recentInvoiceReconciliationErrors()).toHaveLength(1);
  });
  it("seeds and claims at most ten customers without stealing active leases", async () => {
    await state.pg!.exec(
      "insert into users(id,name,email,email_verified) select 'bulk_'||n,'Fixture','bulk_'||n||'@example.test',true from generate_series(1,15) n; insert into subscriptions(user_id,customer_id) select id,'cus_'||id from users where id like 'bulk_%'",
    );
    try {
      expect(await claimInvoiceReconciliations(token)).toHaveLength(10);
      expect(
        (await query("select * from invoice_reconciliation_queue")).rows,
      ).toHaveLength(10);
      expect(await claimInvoiceReconciliations(other)).toHaveLength(6);
      expect(
        (
          await query(
            "select * from invoice_reconciliation_queue where lease_token=$1",
            [token],
          )
        ).rows,
      ).toHaveLength(10);
    } finally {
      await query("delete from users where id like 'bulk_%'");
    }
  });
  it("rechecks the Customer mapping after provider retrieval", async () => {
    await claimInvoiceReconciliations(token);
    state.retrieve.mockImplementationOnce(async () => {
      await query(
        "update subscriptions set customer_id=NULL where user_id='u1'",
      );
      return invoice();
    });
    await expect(reconcileInvoices("cus_1", token)).rejects.toThrow(/mapping/);
    expect((await query("select * from invoices")).rows).toHaveLength(0);
    expect((await queue()).completed_at).toBeNull();
  });
  it("requires a real owned lease for eventless SQL observations", async () => {
    await expect(
      query("select begin_invoice_sync('in_1','cus_1',NULL)"),
    ).rejects.toThrow();
    await expect(
      query(
        "select apply_invoice_observation('in_1','cus_1',NULL,1,'{}',NULL)",
      ),
    ).rejects.toThrow(/origin/);
    await expect(
      query("select begin_invoice_observation('in_1','cus_1',NULL,$1)", [
        token,
      ]),
    ).rejects.toThrow(/lease/);
  });
});
