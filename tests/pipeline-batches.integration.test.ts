import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFileSync, readdirSync } from "node:fs";
import { PgDialect } from "drizzle-orm/pg-core";
import { type SQL } from "drizzle-orm";
const state = vi.hoisted(() => ({
  pg: undefined as PGlite | undefined,
  beforeLanguageWrite: undefined as (() => Promise<void>) | undefined,
}));
vi.mock("@/db", () => ({
  databaseReady: () => true,
  db: () => ({
    execute: async (q: SQL) => {
      const query = new PgDialect().sqlToQuery(q);
      if (
        query.sql.includes("jsonb_to_recordset") &&
        state.beforeLanguageWrite
      ) {
        const hook = state.beforeLanguageWrite;
        state.beforeLanguageWrite = undefined;
        await hook();
      }
      return state.pg!.query(query.sql, query.params);
    },
  }),
}));
import { updateTrends, createDailySnapshots } from "@/lib/pipeline";
import {
  industries,
  industryAliases,
  canonicalIndustry,
  industryMatches,
} from "@/lib/taxonomy";
import { planAnalysisBatch, commitAnalysisBatch } from "@/lib/analysis-batches";
const ids = Array.from(
  { length: 4 },
  (_, i) => "a0000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
);
beforeAll(async () => {
  state.pg = new PGlite({ extensions: { vector } });
  for (const f of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await state.pg.exec(readFileSync("drizzle/" + f, "utf8"));
  for (const [i, id] of ids.entries()) {
    await state.pg.query(
      "insert into pain_clusters(id,title,summary,category,industry,audience) values($1,'Fixture','Test only','test',$2,'Test')",
      [id, i < 2 ? "devtools" : "Инструменты разработчика"],
    );
    await state.pg.query(
      "insert into opportunities(id,cluster_id,slug,title,summary,industry,audience,score) values($1,$1,$2,'Fixture','Test only',$3,'Test',70)",
      [id, "fixture-" + i, i < 2 ? "devtools" : "Инструменты разработчика"],
    );
  }
});
afterAll(async () => state.pg?.close());
describe("Production pipeline SQL against PostgreSQL", () => {
  it("groups Russian and English industry aliases into one canonical trend", async () => {
    await updateTrends();
    expect((await state.pg!.query("select * from trends")).rows).toHaveLength(
      1,
    );
    expect(
      (await state.pg!.query("select * from trend_opportunities")).rows,
    ).toHaveLength(4);
    await updateTrends();
    expect(
      (await state.pg!.query("select * from trend_opportunities")).rows,
    ).toHaveLength(4);
  });
  it("removes obsolete memberships when industry classification changes", async () => {
    await state.pg!.query(
      "update opportunities set industry='Finance' where id=$1",
      [ids[2]],
    );
    await updateTrends();
    const links = (
      await state.pg!.query<{ industry: string; title: string }>(
        "select o.industry,t.title from trend_opportunities l join opportunities o on o.id=l.opportunity_id join trends t on t.id=l.trend_id",
      )
    ).rows;
    expect(links).toHaveLength(3);
    expect(links.every((l) => canonicalIndustry(l.industry) === l.title)).toBe(
      true,
    );
  });
  it("keeps SQL taxonomy and radar matching aligned with application rules", async () => {
    for (const value of [
      ...industries,
      ...Object.keys(industryAliases),
      "  DEVELOPER   TOOLS  ",
      "Unknown fixture",
    ]) {
      const result = (
        await state.pg!.query<{ label: string }>(
          "select canonical_industry($1) as label",
          [value],
        )
      ).rows[0];
      expect(result.label).toBe(canonicalIndustry(value));
    }
    for (const [value, filter] of [
      ["Инструменты разработчика", "Developer tools"],
      ["Healthcare", "медицина"],
      ["Foo", "Bar"],
      ["Foo", "Other / unclear"],
      ["Foo", "foo"],
    ]) {
      const result = (
        await state.pg!.query<{ matches: boolean }>(
          "select industry_matches($1,$2) as matches",
          [value, filter],
        )
      ).rows[0];
      expect(result.matches).toBe(industryMatches(value, filter));
    }
  });
  it("excludes unknown classifications rather than inventing a shared trend", async () => {
    await state.pg!.query(
      "update opportunities set industry='Unknown fixture' where id in ($1,$2)",
      [ids[2], ids[3]],
    );
    await updateTrends();
    expect(
      (await state.pg!.query("select * from trend_opportunities")).rows,
    ).toHaveLength(2);
    expect(
      (
        await state.pg!.query(
          "select * from trends where title='Other / unclear'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("persists a bounded analysis cursor and rejects stale competing commits", async () => {
    const first = await planAnalysisBatch();
    expect(first.ids).toEqual(ids);
    expect(await commitAnalysisBatch(first.previous, first.next)).toBe(true);
    expect(await commitAnalysisBatch(first.previous, ids[0])).toBe(false);
    const next = await planAnalysisBatch();
    expect(next.previous).toBe(ids.at(-1));
    expect(next.ids).toEqual(ids);
  });
  it("materializes a complete snapshot using one SQL invocation", async () => {
    expect(await createDailySnapshots("2026-10-06")).toBe(4);
    expect(await createDailySnapshots("2026-10-06")).toBe(4);
    expect(
      (await state.pg!.query("select * from opportunity_snapshots")).rows,
    ).toHaveLength(4);
  });
  it("runs bounded language maintenance as dry run, then applies with concurrent-write protection", async () => {
    await state.pg!.exec(
      "insert into sources(id,name,config) values('hn','Fixture source','{}')",
    );
    for (const [i, id] of ids.slice(0, 3).entries()) {
      await state.pg!.query(
        "insert into raw_signals(id,source,external_id,url,author,title,content,published_at,language,content_hash) values($1,'hn',$2,$3,'fixture','Test', $4,now(),'ru',$5)",
        [
          id,
          String(i),
          "https://example.test/" + i,
          "I cannot deploy my application because the build fails every time and the error messages do not explain what went wrong.",
          String(i).repeat(64),
        ],
      );
    }
    const previousArgs = process.argv;
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      process.argv = ["node", "reclassify-languages", "--limit=2"];
      await import("../scripts/reclassify-languages");
      expect(JSON.parse(String(output.mock.calls.at(-1)![0]))).toMatchObject({
        dryRun: true,
        scanned: 2,
        proposed: 2,
        updated: 0,
        nextAfter: ids[1],
      });
      expect(
        (
          await state.pg!.query<{ language: string }>(
            "select language from raw_signals where id=$1",
            [ids[0]],
          )
        ).rows[0].language,
      ).toBe("ru");
      state.beforeLanguageWrite = async () => {
        await state.pg!.query(
          "update raw_signals set language='kk' where id=$1",
          [ids[1]],
        );
      };
      vi.resetModules();
      process.argv = ["node", "reclassify-languages", "--limit=2", "--apply"];
      await import("../scripts/reclassify-languages");
      expect(JSON.parse(String(output.mock.calls.at(-1)![0]))).toMatchObject({
        dryRun: false,
        scanned: 2,
        updated: 1,
        skippedConcurrent: 1,
        nextAfter: ids[1],
      });
      expect(
        (
          await state.pg!.query<{ language: string }>(
            "select language from raw_signals where id=$1",
            [ids[1]],
          )
        ).rows[0].language,
      ).toBe("kk");
    } finally {
      process.argv = previousArgs;
      state.beforeLanguageWrite = undefined;
      output.mockRestore();
    }
  });
});
