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
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
const session = vi.hoisted(() => ({
  value: null as null | { user: { id: string } },
}));
vi.mock("@/lib/auth", () => ({ getSession: async () => session.value }));
vi.mock("@/db", () => ({ db: () => database }));
import { POST } from "@/app/api/notifications/route";
import {
  notificationCursor,
  parseNotificationCursor,
} from "@/lib/notification-inbox";
let pg: PGlite;
let database: ReturnType<typeof drizzle>;
const owned = "a0000000-0000-4000-8000-000000000001";
const foreign = "a0000000-0000-4000-8000-000000000002";
const alreadyRead = "a0000000-0000-4000-8000-000000000003";
const incoming = "a0000000-0000-4000-8000-000000000004";
const shared = "a0000000-0000-4000-8000-000000000005";
const team = "b0000000-0000-4000-8000-000000000001";
const workspace = "b0000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  pg = new PGlite({ extensions: { vector } });
  database = drizzle(pg);
  for (const f of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(readFileSync("drizzle/" + f, "utf8"));
  await pg.exec(
    "insert into users(id,name,email,email_verified) values('owner','Owner','owner@example.test',true),('other','Other','other@example.test',true); insert into subscriptions(user_id,plan,status) values('owner','agency','active')",
  );
  await pg.query("select create_agency_team($1,'owner','Team')", [team]);
  await pg.query(
    "select create_client_workspace($1,$2,'owner','Client','Client','Brand','#a58bff')",
    [workspace, team],
  );
});
afterAll(async () => pg?.close());
beforeEach(async () => {
  session.value = { user: { id: "owner" } };
  process.env.NEXT_PUBLIC_APP_URL = "https://painradar.example";
  await pg.exec("delete from notifications");
  for (const id of [owned, foreign, alreadyRead, incoming, shared])
    await pg.query(
      "insert into notifications(id,user_id,workspace_id,dedupe_key,type,title,body,read_at) values($1::uuid,$2,$3,$1::text,'new_opportunity','Fixture','Evidence',$4)",
      [
        id,
        id === foreign ? "other" : "owner",
        id === shared ? workspace : null,
        id === alreadyRead ? "2026-01-01T00:00:00Z" : null,
      ],
    );
});
function request(body: unknown, origin = "https://painradar.example") {
  return new Request("https://painradar.example/api/notifications", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
describe("notification inbox mutations", () => {
  it("marks only selected owned unread notifications and preserves new arrivals", async () => {
    const response = await POST(
      request({ ids: [owned, foreign, alreadyRead, owned] }),
    );
    expect(await response.json()).toEqual({ ok: true, updated: 1 });
    expect(
      (
        await pg.query(
          "select id from notifications where read_at is null order by id",
        )
      ).rows,
    ).toEqual([{ id: foreign }, { id: incoming }, { id: shared }]);
    expect(
      (
        await pg.query<{ read_at: Date }>(
          "select read_at from notifications where id=$1",
          [alreadyRead],
        )
      ).rows[0].read_at.toISOString(),
    ).toBe("2026-01-01T00:00:00.000Z");
  });
  it("keeps the single-id contract and makes repeat requests idempotent", async () => {
    expect(await (await POST(request({ id: owned }))).json()).toEqual({
      ok: true,
      updated: 1,
    });
    expect(await (await POST(request({ id: owned }))).json()).toEqual({
      ok: true,
      updated: 0,
    });
  });
  it("requires a session and same origin", async () => {
    session.value = null;
    expect((await POST(request({ id: owned }))).status).toBe(401);
    session.value = { user: { id: "owner" } };
    expect(
      (await POST(request({ id: owned }, "https://attacker.example"))).status,
    ).toBe(403);
  });
  it("rejects empty, oversized and ambiguous requests", async () => {
    for (const body of [
      { ids: [] },
      { ids: Array(101).fill(owned) },
      { id: owned, ids: [owned] },
      { ids: [owned], userId: "other" },
    ])
      expect((await POST(request(body))).status).toBe(400);
  });
  it("rejects a notification whose workspace no longer grants access", async () => {
    await pg.query("update notifications set user_id='other' where id=$1", [
      shared,
    ]);
    session.value = { user: { id: "other" } };
    expect(await (await POST(request({ ids: [shared] }))).json()).toEqual({
      ok: true,
      updated: 0,
    });
  });
});
describe("notification pagination cursors", () => {
  it("roundtrips timestamps and rejects malformed or oversized cursors", () => {
    const row = { id: owned, createdAt: new Date("2026-10-08T00:00:00Z") };
    expect(parseNotificationCursor(notificationCursor(row))).toEqual({
      ...row,
      createdAt: row.createdAt.toISOString(),
    });
    const precise = { id: owned, createdAt: "2026-10-08T00:00:00.123456Z" };
    expect(parseNotificationCursor(notificationCursor(precise))).toEqual(
      precise,
    );
    for (const value of [
      "invalid",
      "x".repeat(301),
      ["a"],
      Buffer.from(JSON.stringify({ id: owned, createdAt: "invalid" })).toString(
        "base64url",
      ),
    ])
      expect(parseNotificationCursor(value)).toBeNull();
  });
});
