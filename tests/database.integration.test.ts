import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { opportunityPageBoundary } from "@/lib/opportunity-pagination";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFileSync, readdirSync } from "node:fs";
let pg: PGlite;
const user = "test-only-user";
const ids = Array.from(
  { length: 6 },
  (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
);
beforeAll(async () => {
  pg = new PGlite({ extensions: { vector } });
  for (const name of readdirSync("drizzle")
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await pg.exec(readFileSync("drizzle/" + name, "utf8"));
  await pg.query(
    "insert into users(id,name,email) values($1,'Test fixture','fixture@example.test')",
    [user],
  );
  await pg.exec("insert into sources(id,name) values('hn','Hacker News')");
  for (const [i, id] of ids.entries()) {
    await pg.query(
      "insert into pain_clusters(id,title,summary,category,industry,audience) values($1,$2,'Fixture only','test','test','test')",
      [id, "Fixture " + i],
    );
    await pg.query(
      "insert into opportunities(id,cluster_id,slug,title,summary,industry,audience) values($1,$1,$2,'Fixture','Test only','test','test')",
      [id, "test-only-" + i],
    );
  }
});
afterAll(async () => pg?.close());
describe("PostgreSQL migrations and integrity", () => {
  it("creates required tables", async () => {
    const r = await pg.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname='public'",
    );
    const names = r.rows.map((r) => r.tablename);
    for (const table of [
      "users",
      "accounts",
      "sessions",
      "sources",
      "raw_signals",
      "pain_clusters",
      "cluster_signals",
      "opportunities",
      "opportunity_snapshots",
      "trends",
      "radars",
      "watchlists",
      "notifications",
      "reports",
      "subscriptions",
      "api_keys",
      "audit_logs",
    ])
      expect(names).toContain(table);
  });
  it("limits five distinct opens, permits revisits, resets daily", async () => {
    const open = (id: string, day = "2026-01-01") =>
      pg.query<{ allowed: boolean }>(
        "select consume_opportunity_open($1,$2::uuid,$3::date,5) as allowed",
        [user, id, day],
      );
    for (const id of ids.slice(0, 5))
      expect((await open(id)).rows[0].allowed).toBe(true);
    expect((await open(ids[5])).rows[0].allowed).toBe(false);
    expect((await open(ids[0])).rows[0].allowed).toBe(true);
    expect((await open(ids[5], "2026-01-02")).rows[0].allowed).toBe(true);
  });
  it("creates radar and keywords atomically within quota", async () => {
    const create = (id: string) =>
      pg.query<{ radar_id: string | null }>(
        "select create_radar_limited($1::uuid,$2,'Test radar','[]','[]','[\"hn\"]','[\"en\"]',60,'daily','[\"deployment\"]',1) as radar_id",
        [id, user],
      );
    expect((await create(ids[0])).rows[0].radar_id).toBe(ids[0]);
    expect((await create(ids[1])).rows[0].radar_id).toBeNull();
    expect(
      (
        await pg.query("select * from radar_keywords where radar_id=$1", [
          ids[0],
        ])
      ).rows,
    ).toHaveLength(1);
  });
  it("rejects orphan evidence and invalid scores", async () => {
    await expect(
      pg.query(
        "insert into cluster_signals(cluster_id,signal_id) values($1,$2)",
        [ids[0], ids[1]],
      ),
    ).rejects.toThrow();
    await expect(
      pg.query("update opportunities set score=101 where id=$1", [ids[0]]),
    ).rejects.toThrow();
  });
  it("rejects hash and URL duplicates", async () => {
    const q =
      "insert into raw_signals(source,external_id,url,author,title,content,published_at,language,content_hash) values('hn',$1,$2,'fixture','Fixture','Test-only source content',now(),'en',$3)";
    await pg.query(q, ["fixture-1", "https://example.test/1", "fixture-hash"]);
    await expect(
      pg.query(q, ["fixture-2", "https://example.test/2", "fixture-hash"]),
    ).rejects.toThrow();
    await expect(
      pg.query(q, ["fixture-3", "https://example.test/1", "another-hash"]),
    ).rejects.toThrow();
  });
  it("persists snapshots idempotently", async () => {
    const q =
      "insert into opportunity_snapshots(opportunity_id,day,score,mentions,rank,confidence) values($1,'2026-01-01',42,3,1,'Low') on conflict do nothing";
    await pg.query(q, [ids[0]]);
    await pg.query(q, [ids[0]]);
    expect(
      (
        await pg.query(
          "select * from opportunity_snapshots where opportunity_id=$1",
          [ids[0]],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("guards concurrent AI budget reservations", async () => {
    const q =
      "insert into ai_budgets(day,spent_micros) values('2026-01-01',60) on conflict(day) do update set spent_micros=ai_budgets.spent_micros+excluded.spent_micros where ai_budgets.spent_micros+excluded.spent_micros<=100 returning day";
    const r = await Promise.all([pg.query(q), pg.query(q)]);
    expect(r.reduce((n, r) => n + r.rows.length, 0)).toBe(1);
  });
  it("supports cosine similarity in pgvector", async () => {
    expect(
      (
        await pg.query<{ distance: number }>(
          "select '[1,0,0]'::vector <=> '[1,0,0]'::vector as distance",
        )
      ).rows[0].distance,
    ).toBe(0);
  });
  it("atomically deduplicates subscription webhook events", async () => {
    const q =
      "with event as (insert into webhook_events(id) values('fixture-event') on conflict do nothing returning id) insert into subscriptions(user_id,customer_id,plan,status) select $1,'test-customer','pro','active' from event on conflict(user_id) do update set plan=excluded.plan,status=excluded.status";
    await pg.query(q, [user]);
    await pg.query(q, [user]);
    expect(
      (await pg.query("select * from subscriptions where user_id=$1", [user]))
        .rows,
    ).toHaveLength(1);
  });
  it("cascades user-owned data", async () => {
    await pg.exec(
      "insert into users(id,name,email) values('delete-fixture','Test','delete@example.test');insert into watchlists(user_id) values('delete-fixture');delete from users where id='delete-fixture';",
    );
    expect(
      (
        await pg.query(
          "select * from watchlists where user_id='delete-fixture'",
        )
      ).rows,
    ).toHaveLength(0);
  });
});

describe("PostgreSQL keyset pagination", () => {
  it("pages through equal and fractional scores without duplicates or skipped IDs", async () => {
    await pg.exec(
      "update opportunities set score=case when slug in ('test-only-0','test-only-1','test-only-2','test-only-3') then 77.5 else 50 end",
    );
    const seen: string[] = [];
    let after: { score: number; id: string } | undefined;
    for (let i = 0; i < 4; i++) {
      const query = new PgDialect().sqlToQuery(
        sql`select id,score from opportunities where ${after ? opportunityPageBoundary(after) : sql`true`} order by score desc,id asc limit 2`,
      );
      const rows = (
        await pg.query<{ id: string; score: number }>(query.sql, query.params)
      ).rows;
      seen.push(...rows.map((r) => r.id));
      after = rows.at(-1);
      if (!after) break;
    }
    expect(seen).toEqual(ids);
    expect(new Set(seen).size).toBe(6);
  });
});
