import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
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
const state = vi.hoisted(() => ({ pg: undefined as PGlite | undefined }));
vi.mock("@/db", () => ({
  db: () => ({
    execute: async (q: SQL) => {
      const query = new PgDialect().sqlToQuery(q);
      return state.pg!.query(query.sql, query.params);
    },
  }),
}));
import { deduplicateSignals } from "@/lib/pipeline";
import { maintenancePolicy, runMaintenance } from "@/lib/maintenance";
const cluster = "b0000000-0000-4000-8000-000000000001";
const id = (n: number) =>
  "a0000000-0000-4000-8000-" + String(n).padStart(12, "0");
const run = (n: number) =>
  "c0000000-0000-4000-8000-" + String(n).padStart(12, "0");
async function signal(
  n: number,
  changes: Record<string, string | number | null> = {},
) {
  await state.pg!.query(
    "insert into raw_signals(id,source,external_id,url,author,title,content,published_at,created_at,language,metadata,content_hash,processed_at) values($1,'hn',$2,$3,'fixture-author','Fixture title','Test source content only',now()-interval '180 days',now()-interval '180 days','en','{\"fixture\":true}',$4,now()-interval '170 days')",
    [
      id(n),
      String(n),
      "https://example.test/" + n,
      String(n).padStart(64, "0"),
    ],
  );
  for (const [column, value] of Object.entries(changes)) {
    // Test-owned whitelist, not request input.
    if (
      !["published_at", "created_at", "processed_at", "duplicate_of"].includes(
        column,
      )
    )
      throw new Error("Unsupported fixture column");
    await state.pg!.query(`update raw_signals set ${column}=$1 where id=$2`, [
      value,
      id(n),
    ]);
  }
}
beforeAll(async () => {
  state.pg = new PGlite({ extensions: { vector } });
  for (const f of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await state.pg.exec(readFileSync("drizzle/" + f, "utf8"));
  await state.pg.exec(
    "insert into sources(id,name,config) values('hn','Fixture','{}')",
  );
});
afterAll(async () => state.pg?.close());
beforeEach(async () => {
  await state.pg!.exec(
    "delete from cluster_signals; delete from raw_signals; delete from pain_clusters; delete from maintenance_runs; delete from ai_cache; delete from job_runs",
  );
  vi.stubEnv("DATA_MAINTENANCE_ENABLED", "true");
  vi.stubEnv("SIGNAL_PAYLOAD_RETENTION_DAYS", "90");
  vi.stubEnv("AI_CACHE_RETENTION_DAYS", "30");
  vi.stubEnv("JOB_LOG_RETENTION_DAYS", "90");
});
afterEach(() => vi.unstubAllEnvs());
describe("bounded maintenance production SQL", () => {
  it("defaults to disabled and rejects malformed or overly short policies", async () => {
    vi.stubEnv("DATA_MAINTENANCE_ENABLED", undefined);
    expect(maintenancePolicy().enabled).toBe(false);
    await expect(runMaintenance(run(1), false)).rejects.toThrow(/Enable/);
    vi.stubEnv("SIGNAL_PAYLOAD_RETENTION_DAYS", "1");
    expect(() => maintenancePolicy()).toThrow(/configuration/);
  });
  it("previews only old processed unattached signals with both grace periods", async () => {
    await signal(1);
    await signal(2, { published_at: new Date().toISOString() });
    await signal(3, { created_at: new Date().toISOString() });
    await signal(4, { processed_at: new Date().toISOString() });
    await signal(5, { processed_at: null });
    await signal(6);
    await state.pg!.query(
      "insert into pain_clusters(id,title,summary,category,industry,audience) values($1,'Fixture','Fixture','test','Tools','Test')",
      [cluster],
    );
    await state.pg!.query(
      "insert into cluster_signals(cluster_id,signal_id) values($1,$2)",
      [cluster, id(6)],
    );
    const result = await runMaintenance(run(1));
    expect(result).toMatchObject({
      preview: true,
      signalsEligible: 1,
      signalsRetired: 0,
    });
    expect(
      (await state.pg!.query("select * from raw_signals where content<>''"))
        .rows,
    ).toHaveLength(6);
  });
  it("clears payload but preserves source identity, hashes and duplicate references", async () => {
    await signal(1);
    await signal(2, {
      duplicate_of: id(1),
      processed_at: new Date().toISOString(),
    });
    expect(await runMaintenance(run(1), false)).toMatchObject({
      signalsRetired: 1,
    });
    const row = (
      await state.pg!.query<Record<string, unknown>>(
        "select * from raw_signals where id=$1",
        [id(1)],
      )
    ).rows[0];
    expect(row).toMatchObject({
      author: "",
      title: "",
      content: "",
      metadata: {},
      embedding: null,
      url: "https://example.test/1",
      external_id: "1",
      source: "hn",
      content_hash: "1".padStart(64, "0"),
    });
    expect(row.retired_at).not.toBeNull();
    expect(
      (
        await state.pg!.query<{ duplicate_of: string | null }>(
          "select duplicate_of from raw_signals where id=$1",
          [id(2)],
        )
      ).rows[0].duplicate_of,
    ).toBe(id(1));
    await expect(
      state.pg!.query(
        "update raw_signals set content='Restored text' where id=$1",
        [id(1)],
      ),
    ).rejects.toThrow(/signal_retired_payload_check/);
  });
  it("blocks adding a retired signal as new evidence", async () => {
    await signal(1);
    await runMaintenance(run(1), false);
    await state.pg!.query(
      "insert into pain_clusters(id,title,summary,category,industry,audience) values($1,'Fixture','Fixture','test','Tools','Test')",
      [cluster],
    );
    await expect(
      state.pg!.query(
        "insert into cluster_signals(cluster_id,signal_id) values($1,$2)",
        [cluster, id(1)],
      ),
    ).rejects.toThrow(/Retired signal/);
  });
  it("keeps deduplication markers so recollection cannot reinsert the same source", async () => {
    await signal(1);
    await runMaintenance(run(1), false);
    const result = await state.pg!.query(
      "insert into raw_signals(source,external_id,url,author,title,content,published_at,language,content_hash) values('hn','1','https://example.test/1','fixture','Fixture','Recollected text',now(),'en',$1) on conflict do nothing returning id",
      ["1".padStart(64, "0")],
    );
    expect(result.rows).toHaveLength(0);
  });
  it("deduplicates retries by run UUID and leaves the next batch for a new run", async () => {
    await signal(1);
    const first = await runMaintenance(run(1), false);
    await signal(2);
    expect(await runMaintenance(run(1), false)).toEqual(first);
    expect(
      (
        await state.pg!.query(
          "select * from raw_signals where retired_at is null",
        )
      ).rows,
    ).toHaveLength(1);
    expect(await runMaintenance(run(2), false)).toMatchObject({
      signalsRetired: 1,
    });
  });
  it("preserves running jobs and recent logs, deleting only expired cache and terminal logs", async () => {
    await state.pg!.exec(
      "insert into ai_cache(key,kind,payload,created_at) values('old','test','{}',now()-interval '40 days'),('fresh','test','{}',now()); insert into job_runs(id,job,status,finished_at) values('old','test','failed',now()-interval '100 days'),('fresh','test','completed',now()),('running','test','running',now()-interval '100 days'),('unfinished','test','failed',NULL)",
    );
    expect(await runMaintenance(run(1), false)).toMatchObject({
      cacheDeleted: 1,
      logsDeleted: 1,
    });
    expect((await state.pg!.query("select * from ai_cache")).rows).toHaveLength(
      1,
    );
    expect((await state.pg!.query("select * from job_runs")).rows).toHaveLength(
      3,
    );
  });
  it("caps each category at 500 and reports remaining eligible rows", async () => {
    await state.pg!.exec(
      "insert into raw_signals(source,external_id,url,author,title,content,published_at,created_at,language,content_hash,processed_at) select 'hn',g::text,'https://example.test/'||g,'fixture','Fixture','Fixture source text',now()-interval '180 days',now()-interval '180 days','en',md5(g::text),now()-interval '170 days' from generate_series(1,501) g; insert into ai_cache(key,kind,payload,created_at) select g::text,'test','{}',now()-interval '40 days' from generate_series(1,501) g; insert into job_runs(id,job,status,finished_at) select g::text,'test','completed',now()-interval '100 days' from generate_series(1,501) g",
    );
    expect(await runMaintenance(run(1), false)).toMatchObject({
      signalsRetired: 500,
      cacheDeleted: 500,
      logsDeleted: 500,
      signalsMore: true,
      cacheMore: true,
      logsMore: true,
    });
    expect(await runMaintenance(run(2), false)).toMatchObject({
      signalsRetired: 1,
      cacheDeleted: 1,
      logsDeleted: 1,
      signalsMore: false,
    });
  });
  it("validates bounds in SQL as well as application config", async () => {
    await expect(
      state.pg!.query("select run_data_maintenance($1,0,30,90,false)", [
        run(1),
      ]),
    ).rejects.toThrow(/Invalid maintenance/);
    await expect(
      state.pg!.query("select run_data_maintenance($1,90,30,90,NULL)", [
        run(1),
      ]),
    ).rejects.toThrow(/Invalid maintenance/);
  });
  it("honors a disabled live flag even when a job froze an enabled policy", async () => {
    const policy = maintenancePolicy();
    vi.stubEnv("DATA_MAINTENANCE_ENABLED", "false");
    await expect(runMaintenance(run(1), false, policy)).rejects.toThrow(
      /Enable/,
    );
  });
  it("deduplicates using actual collection timestamps and skips retired originals", async () => {
    await signal(1);
    await signal(2, { processed_at: null });
    await state.pg!.exec(
      "update raw_signals set embedding=array_fill(0.1::real,array[1536])::vector",
    );
    await state.pg!.query(
      "update raw_signals set created_at='2026-01-01' where id=$1",
      [id(1)],
    );
    await state.pg!.query(
      "update raw_signals set created_at='2026-01-02' where id=$1",
      [id(2)],
    );
    expect(await deduplicateSignals()).toBe(1);
    expect(
      (
        await state.pg!.query<{ duplicate_of: string | null }>(
          "select duplicate_of from raw_signals where id=$1",
          [id(2)],
        )
      ).rows[0].duplicate_of,
    ).toBe(id(1));
    await runMaintenance(run(1), false);
    await signal(3, { processed_at: null });
    await state.pg!.query(
      "update raw_signals set embedding=array_fill(0.1::real,array[1536])::vector where id=$1",
      [id(3)],
    );
    expect(await deduplicateSignals()).toBe(0);
  });
});
