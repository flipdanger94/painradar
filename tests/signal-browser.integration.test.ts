import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
const state = vi.hoisted(() => ({
  pg: undefined as PGlite | undefined,
  ready: true,
}));
vi.mock("@/db", () => ({
  databaseReady: () => state.ready,
  db: () => drizzle(state.pg!),
}));
import { listSignals, signalFilters, signalPageHref } from "@/lib/signals";
import { embeddingModel } from "@/lib/gemini";
const ids = Array.from(
  { length: 31 },
  (_, i) => "d0000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
);
beforeAll(async () => {
  state.pg = new PGlite({ extensions: { vector } });
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await state.pg.exec(readFileSync("drizzle/" + file, "utf8"));
  await state.pg.exec(
    "insert into sources(id,name,config) values('hn','Hacker News','{}'),('github','GitHub Issues','{}')",
  );
  const v = JSON.stringify([1, ...Array(1535).fill(0)]);
  for (const [i, id] of ids.entries())
    await state.pg.query(
      "insert into raw_signals(id,source,external_id,url,author,title,content,published_at,language,content_hash,embedding,embedding_model,processed_at,duplicate_of,retired_at) values($1,$2,$3,$4,'fixture',$5,$6,now(),'en',$7,$8::vector,$9,$10,$11::uuid,$12)",
      [
        id,
        i % 2 ? "github" : "hn",
        String(i),
        "https://example.test/" + i,
        i === 0 ? "100% build_failed" : "Build failure " + i,
        "Original public source " + "x".repeat(300),
        String(i).padStart(64, "0"),
        i % 4 === 0 ? null : v,
        i === 29 ? "old-model" : embeddingModel(),
        i % 4 === 2 ? new Date() : null,
        i % 4 === 3 ? ids[0] : null,
        null,
      ],
    );
  await state.pg.query(
    "update raw_signals set retired_at=now(),author='',title='',content='',embedding=null where id=$1",
    [ids[30]],
  );
});
afterAll(async () => state.pg?.close());
describe("signal browsing", () => {
  it("sanitizes malformed filters and preserves encoded pagination values", () => {
    expect(
      signalFilters({
        q: "  test  ",
        source: "unknown",
        state: ["processed"],
        page: "-1",
      }),
    ).toEqual({ q: "test", source: "", state: "", page: 1 });
    expect(
      signalFilters({ page: "99999999", q: "x".repeat(300) }),
    ).toMatchObject({ page: 10000, q: "x".repeat(200) });
    const url = new URL(
      signalPageHref(
        signalFilters({ q: "a & b", source: "github", state: "queued" }),
        2,
      ),
      "https://example.test",
    );
    expect(url.searchParams.get("q")).toBe("a & b");
    expect(url.searchParams.get("state")).toBe("queued");
    expect(url.searchParams.get("page")).toBe("2");
  });
  it("returns bounded pages without vectors, metadata or retired signals", async () => {
    const first = await listSignals(signalFilters({}));
    const second = await listSignals(signalFilters({ page: "2" }));
    expect(first).toMatchObject({ total: 30, page: 1, pages: 2 });
    expect(first.rows).toHaveLength(20);
    expect(second.rows).toHaveLength(10);
    expect(new Set([...first.rows, ...second.rows].map((r) => r.id)).size).toBe(
      30,
    );
    expect(first.rows[0].excerpt).toHaveLength(240);
    expect(first.rows[0]).not.toHaveProperty("embedding");
    expect(first.rows[0]).not.toHaveProperty("metadata");
  });
  it("filters source and mutually exclusive processing states", async () => {
    const github = await listSignals(signalFilters({ source: "github" }));
    expect(github.total).toBe(15);
    expect(github.rows.every((r) => r.source === "github")).toBe(true);
    for (const status of ["queued", "related", "processed", "duplicate"]) {
      const result = await listSignals(signalFilters({ state: status }));
      expect(result.total).toBeGreaterThan(0);
      expect(result.rows.every((r) => r.state === status)).toBe(true);
    }
  });
  it("searches literal wildcard characters without interpreting SQL syntax", async () => {
    expect(
      (await listSignals(signalFilters({ q: "100% build_failed" }))).total,
    ).toBe(1);
    expect(
      (await listSignals(signalFilters({ q: "%' OR 1=1 --" }))).total,
    ).toBe(0);
    expect((await listSignals(signalFilters({ page: "999" }))).page).toBe(2);
  });
  it("returns an honest empty state when the database is not configured", async () => {
    state.ready = false;
    try {
      expect(await listSignals(signalFilters({}))).toEqual({
        rows: [],
        total: 0,
        page: 1,
        pages: 1,
      });
    } finally {
      state.ready = true;
    }
  });
});
