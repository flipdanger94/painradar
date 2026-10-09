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
const state = vi.hoisted(() => ({
  pg: undefined as PGlite | undefined,
  role: "admin",
  api: vi.fn(),
}));
vi.mock("@/db", () => ({
  db: () => drizzle(state.pg!),
  databaseReady: () => true,
}));
vi.mock("@/lib/auth", () => ({
  getSession: async () => ({ user: { id: "admin", role: state.role } }),
}));
vi.mock("@/lib/sources/public-fetch", () => ({
  publicJson: state.api,
  publicFetch: vi.fn(),
}));
import { POST as importCsv } from "@/app/api/admin/sources/import/route";
import { POST as configure } from "@/app/api/admin/sources/route";
import { collectSourceBatch } from "@/lib/pipeline";
import { listSignals, signalFilters } from "@/lib/signals";
beforeAll(async () => {
  state.pg = new PGlite({ extensions: { vector } });
  for (const f of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await state.pg.exec(readFileSync("drizzle/" + f, "utf8"));
  await state.pg.exec(
    "insert into users(id,name,email,role) values('admin','Admin','admin@test.dev','admin')",
  );
});
afterAll(async () => state.pg?.close());
beforeEach(() => {
  state.role = "admin";
  process.env.NEXT_PUBLIC_APP_URL = "https://painradar.example";
  vi.stubEnv("NODE_ENV", "test");
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});
const csv =
  "title,content,url,published_at\nBroken workflow,The integration is unreliable and fails during every release.,https://public.example.org/issue,2026-10-03T12:00:00Z\n";
const req = (
  path: string,
  body: unknown,
  origin = "https://painradar.example",
) =>
  new Request("https://painradar.example" + path, {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
describe("source configuration and import flow", () => {
  it("guards imports by role, origin and explicit sharing consent", async () => {
    state.role = "user";
    expect(
      (
        await importCsv(
          req("/api/admin/sources/import", { csv, confirmed: true }),
        )
      ).status,
    ).toBe(403);
    state.role = "admin";
    expect(
      (
        await importCsv(
          req(
            "/api/admin/sources/import",
            { csv, confirmed: true },
            "https://attacker.example",
          ),
        )
      ).status,
    ).toBe(403);
    expect(
      (await importCsv(req("/api/admin/sources/import", { csv }))).status,
    ).toBe(400);
  });
  it("imports to the real signal queue, deduplicates retries, and filters by CSV", async () => {
    let r = await importCsv(
      req("/api/admin/sources/import", { csv, confirmed: true }),
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ inserted: 1, duplicates: 0 });
    r = await importCsv(
      req("/api/admin/sources/import", { csv, confirmed: true }),
    );
    expect(await r.json()).toMatchObject({ inserted: 0, duplicates: 1 });
    const data = await listSignals(
      signalFilters({ source: "csv", state: "queued" }),
    );
    expect(data.total).toBe(1);
    expect(data.rows[0]).toMatchObject({ source: "csv", state: "queued" });
  });
  it("rejects an invalid row without partially importing the file", async () => {
    const bad =
      csv +
      "Bad row,This is sufficient content for validation purposes.,https://127.0.0.1/secret,2026-10-03T12:00:00Z\n";
    expect(
      (
        await importCsv(
          req("/api/admin/sources/import", { csv: bad, confirmed: true }),
        )
      ).status,
    ).toBe(400);
    expect((await listSignals(signalFilters({ source: "csv" }))).total).toBe(1);
  });
  it("saves scopes, collects attributed Stack Exchange questions, and persists provider backoff", async () => {
    expect(
      (
        await configure(
          req("/api/admin/sources", {
            id: "stackexchange",
            enabled: true,
            config: {
              tags: ["python"],
              site: "stackoverflow",
              since: "2026-10-01T00:00:00Z",
            },
          }),
        )
      ).status,
    ).toBe(200);
    state.api.mockResolvedValue({
      data: {
        has_more: true,
        backoff: 120,
        quota_remaining: 99,
        items: [
          {
            question_id: 17,
            link: "https://stackoverflow.com/questions/17",
            title: "Workflow failure",
            body: "<p>I cannot deploy my workflow reliably and need help.</p>",
            creation_date: 1791028800,
            owner: { display_name: "Author" },
            score: 0,
            answer_count: 0,
          },
        ],
      },
    });
    const result = await collectSourceBatch("stackexchange", 1);
    expect(result.inserted).toBe(1);
    expect(result).toHaveProperty("warning");
    const again = await collectSourceBatch("stackexchange", 1);
    expect(again).toMatchObject({ warning: "Source retry later" });
    expect(state.api).toHaveBeenCalledTimes(1);
    const data = await listSignals(signalFilters({ source: "stackexchange" }));
    expect(data.total).toBe(1);
    expect(data.rows[0].license).toBe("CC BY-SA");
    expect(
      (
        await configure(
          req("/api/admin/sources", {
            id: "stackexchange",
            enabled: true,
            config: { tags: ["node.js"], site: "stackoverflow" },
          }),
        )
      ).status,
    ).toBe(200);
    expect(await collectSourceBatch("stackexchange", 1)).toMatchObject({
      warning: "Source retry later",
    });
    expect(state.api).toHaveBeenCalledTimes(1);
  });
});
