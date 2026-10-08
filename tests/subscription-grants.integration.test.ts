import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
const state = vi.hoisted(() => ({ pg: undefined as PGlite | undefined }));
vi.mock("@/db", () => ({ db: () => drizzle(state.pg!) }));
vi.mock("@/lib/auth", () => ({ getSession: async () => null }));
import { userPlan } from "@/lib/security";
import { grantInput, grantAccount } from "@/lib/subscription-grants";
beforeAll(async () => {
  state.pg = new PGlite({ extensions: { vector } });
  for (const f of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await state.pg.exec(readFileSync("drizzle/" + f, "utf8"));
  await state.pg.exec(
    `insert into users(id,name,email,role) values('admin','Admin','admin@test.dev','admin'),('member','Member','member@test.dev','user'),('paid','Paid','paid@test.dev','user'); insert into subscriptions(user_id,plan,status,current_period_end) values('paid','agency','active',now()+interval '365 days')`,
  );
});
afterAll(async () => state.pg?.close());
async function change(
  action: string,
  email = "member@test.dev",
  days: number | null = 30,
  plan = "founder",
  actor = "admin",
  reason = "Testing grant",
  requestId = randomUUID(),
) {
  const r = await state.pg!.query<{ outcome: Record<string, unknown> }>(
    "select manage_subscription_grant($1,$2,$3,$4,$5,$6,$7::uuid) as outcome",
    [actor, email, action, plan, days, reason, requestId],
  );
  return r.rows[0].outcome;
}
describe("manual subscriptions", () => {
  it("deduplicates a retried grant without a second audit event", async () => {
    const id = randomUUID();
    expect(
      await change(
        "grant",
        "member@test.dev",
        30,
        "founder",
        "admin",
        "Retry safety",
        id,
      ),
    ).toEqual({ ok: true });
    expect(
      await change(
        "grant",
        "member@test.dev",
        30,
        "founder",
        "admin",
        "Retry safety",
        id,
      ),
    ).toEqual({ ok: true });
    const r = await state.pg!.query<{ n: number }>(
      "select count(*)::int as n from audit_logs where metadata->>'requestId'=$1",
      [id],
    );
    expect(r.rows[0].n).toBe(1);
    await state.pg!.exec(
      "delete from audit_logs; delete from subscription_grants",
    );
  });
  it("rejects nonadmins, unknown users and empty reasons without mutation", async () => {
    expect(
      await change("grant", "member@test.dev", 30, "founder", "member"),
    ).toMatchObject({ status: 403 });
    expect(await change("grant", "missing@test.dev")).toMatchObject({
      status: 404,
    });
    expect(
      await change("grant", "member@test.dev", 30, "founder", "admin", "  "),
    ).toMatchObject({ status: 400 });
    expect(await userPlan("member")).toBe("free");
    expect(
      grantInput.safeParse({
        email: "m@test.dev",
        action: "grant",
        plan: "founder",
        duration: "999",
        reason: "hello",
      }).success,
    ).toBe(false);
  });
  it("grants immediately, extends from expiry and atomically records the actor and reason", async () => {
    expect(await change("grant", " MEMBER@test.dev ")).toEqual({ ok: true });
    expect(await userPlan("member")).toBe("founder");
    const before = await grantAccount("member@test.dev");
    expect(await change("extend", "member@test.dev", 90, "pro")).toEqual({
      ok: true,
    });
    const after = await grantAccount("member@test.dev");
    expect(after!.plan).toBe("founder");
    expect(
      new Date(after!.expires_at as string).getTime() -
        new Date(before!.expires_at as string).getTime(),
    ).toBe(90 * 86400000);
    const history = after!.history as { reason: string; actor: string }[];
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      reason: "Testing grant",
      actor: "admin@test.dev",
    });
  });
  it("supports lifetime access and revocation, preserving paid Stripe access", async () => {
    expect(await change("grant", "member@test.dev", null)).toEqual({
      ok: true,
    });
    expect(await change("extend")).toMatchObject({ status: 409 });
    expect(await change("revoke")).toEqual({ ok: true });
    expect(await userPlan("member")).toBe("free");
    expect(await change("grant", "paid@test.dev", 30, "pro")).toEqual({
      ok: true,
    });
    expect(await userPlan("paid")).toBe("agency");
    expect(await change("revoke", "paid@test.dev")).toEqual({ ok: true });
    expect(await userPlan("paid")).toBe("agency");
    const r = await state.pg!.query(
      "select plan,status from subscriptions where user_id='paid'",
    );
    expect(r.rows[0]).toEqual({ plan: "agency", status: "active" });
  });
  it("expires automatically and disallows extending or revoking expired grants", async () => {
    await change("grant");
    await state.pg!.exec(
      "update subscription_grants set expires_at=now()-interval '1 second' where user_id='member'",
    );
    expect(await userPlan("member")).toBe("free");
    expect(await change("extend")).toMatchObject({ status: 409 });
    expect(await change("revoke")).toMatchObject({ status: 409 });
  });
});
