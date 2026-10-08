import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFileSync, readdirSync } from "node:fs";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { collectionCheckpointGuard } from "@/lib/sources/checkpoint";
import { PIPELINE_LIMITS } from "@/lib/analysis-batches";
let pg: PGlite;
const day = new Date().toISOString().slice(0, 10),
  team = "b0000000-0000-4000-8000-000000000001",
  workspace = "b0000000-0000-4000-8000-000000000002",
  radar = "b0000000-0000-4000-8000-000000000003",
  hook = "b0000000-0000-4000-8000-000000000004",
  owner = "b0000000-0000-4000-8000-000000000005",
  newOwner = "b0000000-0000-4000-8000-000000000006";
const ids = Array.from(
  { length: 3 },
  (_, i) => "a0000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
);
let job: string;
beforeAll(async () => {
  pg = new PGlite({ extensions: { vector } });
  for (const f of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(readFileSync("drizzle/" + f, "utf8"));
  for (const u of ["owner", "member", "offboarded"])
    await pg.query(
      "insert into users(id,name,email,email_verified) values($1,'Test fixture',$2,true)",
      [u, u + "@example.test"],
    );
  await pg.exec(
    "insert into subscriptions(user_id,plan,status) values('owner','agency','active');insert into sources(id,name,config) values('hn','Test source','{}')",
  );
  await pg.query("select create_agency_team($1,'owner','Test team')", [team]);
  await pg.query(
    "select create_client_workspace($1,$2,'owner','Test workspace','Client','Brand','#a58bff')",
    [workspace, team],
  );
  for (const u of ["member", "offboarded"]) {
    await pg.query("insert into team_members(team_id,user_id) values($1,$2)", [
      team,
      u,
    ]);
    await pg.query("select set_workspace_member($1,'owner',$2,'viewer')", [
      workspace,
      u,
    ]);
  }
  await pg.query(
    "insert into radars(id,user_id,workspace_id,name,alert_threshold,frequency,sources,languages,excluded_words,industries) values($1,'owner',$2,'Test radar',50,'daily','[\"hn\"]','[\"kk\"]','[\"excluded\"]','[\"Инструменты разработчика\"]')",
    [radar, workspace],
  );
  await pg.query(
    "insert into radar_keywords(radar_id,keyword) values($1,'PAIN')",
    [radar],
  );
  await pg.query(
    "insert into outbound_webhooks(id,workspace_id,name,url,secret_ciphertext,events,created_by) values($1,$2,'Test webhook','https://hooks.example.test','test-only-cipher','[\"new_opportunity\"]','owner')",
    [hook, workspace],
  );
  for (const [i, id] of ids.entries()) {
    await pg.query(
      "insert into pain_clusters(id,title,summary,category,industry,audience) values($1,'Test','Fixture','test','Developer tools','Test')",
      [id],
    );
    await pg.query(
      "insert into opportunities(id,cluster_id,slug,title,summary,industry,audience,score,mentions,confidence) values($1,$1,$2,$3,'Test-only evidence','Developer tools','Test',70,3,'Low')",
      [id, "fixture-" + i, i === 1 ? "PAIN excluded" : "PAIN observed"],
    );
    const sig = await pg.query<{ id: string }>(
      "insert into raw_signals(source,external_id,url,author,title,content,published_at,language,content_hash) values('hn',$1,$2,'fixture','Fixture','Test-only source evidence',now(),'kk',$3) returning id",
      ["source-" + i, "https://example.test/" + i, "hash-" + i],
    );
    await pg.query(
      "insert into cluster_signals(cluster_id,signal_id) values($1,$2)",
      [id, sig.rows[0].id],
    );
  }
  await pg.query("select capture_daily_snapshots($1::date)", [day]);
  await pg.query("select enqueue_publications($1::date)", [day]);
  job = (
    await pg.query<{ id: string }>(
      "select id from publication_jobs where radar_id=$1",
      [radar],
    )
  ).rows[0].id;
});
afterAll(async () => pg?.close());
describe("Bounded publication queue", () => {
  it("freezes snapshot rank and values across reruns", async () => {
    await pg.query("update opportunities set score=99 where id=$1", [ids[2]]);
    await pg.query("select capture_daily_snapshots($1::date)", [day]);
    const rows = (
      await pg.query<{ score: number; rank: number }>(
        "select score,rank from opportunity_snapshots where day=$1 order by rank",
        [day],
      )
    ).rows;
    expect(rows.map((r) => r.score)).toEqual([70, 70, 70]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
  it("enqueues jobs once per radar/workspace/day and enforces scope", async () => {
    await pg.query("select enqueue_publications($1::date)", [day]);
    expect(
      (await pg.query("select * from publication_jobs where day=$1", [day]))
        .rows,
    ).toHaveLength(2);
    await expect(
      pg.query(
        "insert into publication_jobs(kind,radar_id,workspace_id,day) values('radar',$1,$2,$3)",
        [radar, workspace, day],
      ),
    ).rejects.toThrow();
  });
  it("leases pending jobs once and recovers expired leases", async () => {
    expect(
      (await pg.query("select * from claim_publications($1,5)", [owner])).rows,
    ).toHaveLength(2);
    expect(
      (await pg.query("select * from claim_publications($1,5)", [newOwner]))
        .rows,
    ).toHaveLength(0);
    await pg.query(
      "update publication_jobs set lease_until=now()-interval '1 second' where id=$1",
      [job],
    );
    expect(
      (await pg.query("select * from claim_publications($1,5)", [newOwner]))
        .rows,
    ).toHaveLength(1);
  });
  it("fences stale workers before mutation", async () => {
    const r = (
      await pg.query<{ lease_lost: boolean }>(
        "select * from process_radar_publication($1,$2,1)",
        [job, owner],
      )
    ).rows[0];
    expect(r.lease_lost).toBe(true);
    expect((await pg.query("select * from notifications")).rows).toHaveLength(
      0,
    );
  });
  it("checks current audience, matches literal keywords/exclusions and commits outbox with notification", async () => {
    await pg.query(
      "select manage_team_member($1,'owner','offboarded','remove','member')",
      [team],
    );
    const r = (
      await pg.query<{ scanned: number; created: number }>(
        "select * from process_radar_publication($1,$2,1)",
        [job, newOwner],
      )
    ).rows[0];
    expect(r.scanned).toBe(1);
    expect(r.created).toBe(2);
    const recipients = (
      await pg.query<{ user_id: string; body: string }>(
        "select user_id,body from notifications order by user_id",
      )
    ).rows;
    expect(recipients.map((r) => r.user_id)).toEqual(["member", "owner"]);
    expect(recipients[0].body).toContain("Score 70");
    expect(
      (await pg.query("select * from webhook_deliveries")).rows,
    ).toHaveLength(1);
  });
  it("advances past unmatched pages then resumes until complete without duplicate alerts", async () => {
    const excluded = (
      await pg.query<{ created: number }>(
        "select * from process_radar_publication($1,$2,1)",
        [job, newOwner],
      )
    ).rows[0];
    expect(excluded.created).toBe(0);
    await pg.query("select * from process_radar_publication($1,$2,1)", [
      job,
      newOwner,
    ]);
    const done = (
      await pg.query<{ complete: boolean }>(
        "select * from process_radar_publication($1,$2,1)",
        [job, newOwner],
      )
    ).rows[0];
    expect(done.complete).toBe(true);
    expect((await pg.query("select * from notifications")).rows).toHaveLength(
      4,
    );
    expect(
      (await pg.query("select * from webhook_deliveries")).rows,
    ).toHaveLength(2);
  });
  it("pauses inactive sponsor jobs and expires abandoned work after seven days", async () => {
    await pg.query(
      "update publication_jobs set lease_until=null,lease_token=null where kind='workspace'",
    );
    await pg.exec(
      "update subscriptions set status='canceled' where user_id='owner'",
    );
    expect(
      (await pg.query("select * from claim_publications($1,5)", [owner])).rows,
    ).toHaveLength(0);
    await pg.query(
      "insert into publication_jobs(kind,radar_id,day) values('radar',$1,current_date-8)",
      [radar],
    );
    await pg.query("select * from claim_publications($1,5)", [owner]);
    expect(
      (
        await pg.query<{ status: string }>(
          "select status from publication_jobs where day=current_date-8",
        )
      ).rows[0].status,
    ).toBe("expired");
  });
  it("rejects stale ingestion checkpoint writes even if configuration is unchanged", async () => {
    const guard = collectionCheckpointGuard({}, null, null);
    const q = new PgDialect().sqlToQuery(
      sql`update sources set last_collected_at=now() where id='hn' and ${guard} returning id`,
    );
    expect((await pg.query(q.sql, q.params)).rows).toHaveLength(1);
    expect((await pg.query(q.sql, q.params)).rows).toHaveLength(0);
  });
  it("keeps the daily workflow below the platform step ceiling", () => {
    const max =
      PIPELINE_LIMITS.embeddings +
      PIPELINE_LIMITS.seeds +
      PIPELINE_LIMITS.analysis * 2 +
      60;
    expect(max).toBeLessThan(1000);
  });
});
