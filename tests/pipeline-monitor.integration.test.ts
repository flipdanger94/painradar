import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { type SQL } from "drizzle-orm";
import { readFileSync, readdirSync } from "node:fs";
const state = vi.hoisted(() => ({ pg: undefined as PGlite | undefined }));
vi.mock("@/db", () => ({
  databaseReady: () => true,
  db: () => {
    const orm = drizzle(state.pg!);
    return Object.assign(orm, {
      execute: async (q: SQL) => {
        const query = new PgDialect().sqlToQuery(q);
        return state.pg!.query(query.sql, query.params);
      },
    });
  },
}));
import { pipelineStatus, recordProgress } from "@/lib/pipeline-status";
import { embeddingModel } from "@/lib/gemini";
import { planGroupingBatch, commitGroupingBatch } from "@/lib/analysis-batches";
const ids = Array.from(
  { length: 25 },
  (_, i) => "b0000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
);
beforeAll(async () => {
  state.pg = new PGlite({ extensions: { vector } });
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await state.pg.exec(readFileSync("drizzle/" + file, "utf8"));
  await state.pg.query(
    "insert into sources(id,name,config,health,last_error) values('github','GitHub Issues',$1,'collecting','private provider error')",
    [JSON.stringify({ repositories: ["vercel/next.js"] })],
  );
  const embedding = JSON.stringify([1, ...Array(1535).fill(0)]);
  for (const [i, id] of ids.entries())
    await state.pg.query(
      "insert into raw_signals(id,source,external_id,url,author,title,content,published_at,language,content_hash,embedding,embedding_model) values($1,'github',$2,$3,$2,'Original issue','Test',now(),'en',$4,$5::vector,$6)",
      [
        id,
        String(i),
        "https://github.com/vercel/next.js/issues/" + (i + 1),
        String(i).padStart(64, "0"),
        embedding,
        embeddingModel(),
      ],
    );
  await state.pg.query(
    "insert into raw_signals(source,external_id,url,author,title,content,published_at,language,content_hash) values('github','pending','https://example.test/pending','fixture','Pending','Test',now(),'en',$1)",
    ["z".repeat(64)],
  );
});
afterAll(async () => state.pg?.close());
describe("live collection progress", () => {
  it("reports real queue counts and configured scopes without leaking provider errors", async () => {
    const data = await pipelineStatus();
    expect(data?.counts).toMatchObject({
      signals: 26,
      embedded: 25,
      queued: 1,
      awaitingGrouping: 25,
      opportunities: 0,
    });
    expect(data?.sources.find((s) => s.id === "github")).toMatchObject({
      scopes: ["vercel/next.js"],
      signals: 26,
      health: "collecting",
    });
    expect(JSON.stringify(data)).not.toContain("private provider error");
    expect(data?.recent).toHaveLength(5);
  });
  it("reserves at most one queued or running collection and releases the slot on failure", async () => {
    await state.pg!.query(
      "insert into job_runs(id,job,status) values('run-one','daily-radar','queued')",
    );
    expect(
      (
        await state.pg!.query(
          "insert into job_runs(id,job,status) values('run-two','daily-radar','running') on conflict do nothing returning id",
        )
      ).rows,
    ).toHaveLength(0);
    await state.pg!.query(
      "update job_runs set status='running' where id='run-one'",
    );
    await recordProgress("run-one", "embed", 12, 40);
    expect((await pipelineStatus())?.job?.progress).toMatchObject({
      stage: "embed",
      done: 12,
      total: 40,
    });
    await state.pg!.query(
      "update job_runs set status='failed',finished_at=now(),error='private job error' where id='run-one'",
    );
    await recordProgress("run-one", "embed", 13, 40);
    expect((await pipelineStatus())?.job?.progress?.done).toBe(12);
    expect(JSON.stringify(await pipelineStatus())).not.toContain(
      "private job error",
    );
    expect(
      (
        await state.pg!.query(
          "insert into job_runs(id,job,status) values('run-two','daily-radar','running') returning id",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("reports a stalled run using its last progress, rather than its starting time", async () => {
    await state.pg!.query(
      "update job_runs set status='completed' where status in ('queued','running')",
    );
    await state.pg!.query(
      "insert into job_runs(id,job,status,created_at) values('stalled-visible','daily-radar','running',now()+interval '1 second'-interval '2 hours')",
    );
    // Make this the latest run while retaining an old last-progress timestamp.
    await state.pg!.query(
      "update job_runs set created_at=now()+interval '1 second',progress=$1 where id='stalled-visible'",
      [
        JSON.stringify({
          stage: "embed",
          done: 2,
          total: 40,
          updatedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
        }),
      ],
    );
    expect((await pipelineStatus())?.job).toMatchObject({
      id: "stalled-visible",
      stalled: true,
    });
    await recordProgress("stalled-visible", "embed", 3, 40);
    expect((await pipelineStatus())?.job?.stalled).toBe(false);
  });
  it("rotates grouping seeds beyond the first batch and rejects stale cursor writes", async () => {
    const first = await planGroupingBatch();
    expect(first.ids).toEqual(ids.slice(0, 20));
    expect(await commitGroupingBatch(first.previous, first.next)).toBe(true);
    expect(await commitGroupingBatch(first.previous, ids[0])).toBe(false);
    const second = await planGroupingBatch();
    expect(second.ids).toEqual(ids.slice(20));
    expect(await commitGroupingBatch(second.previous, second.next)).toBe(true);
    expect((await planGroupingBatch()).ids).toEqual(ids.slice(0, 20));
  });
});
