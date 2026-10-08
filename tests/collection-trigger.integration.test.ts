import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { PgDialect } from "drizzle-orm/pg-core";
import { type SQL } from "drizzle-orm";
import { readFileSync, readdirSync } from "node:fs";
const state = vi.hoisted(() => ({
  pg: undefined as PGlite | undefined,
  send: vi.fn(),
  role: "admin",
}));
vi.mock("@/db", () => ({
  db: () => ({
    execute: async (q: SQL) => {
      const query = new PgDialect().sqlToQuery(q);
      return state.pg!.query(query.sql, query.params);
    },
  }),
}));
vi.mock("@/lib/jobs", () => ({ inngest: { send: state.send } }));
vi.mock("@/lib/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security")>();
  return {
    ...actual,
    requireAdmin: async () => {
      if (state.role !== "admin")
        throw new actual.ApiError(403, "Administrator access required.");
      return { id: "fixture" };
    },
    rateLimit: vi.fn(),
    audit: vi.fn(),
  };
});
import { POST } from "@/app/api/admin/collect/route";
const request = (body: unknown) =>
  new Request("https://example.test/api/admin/collect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://example.test",
    },
    body: JSON.stringify(body),
  });
beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test");
  vi.stubEnv("GEMINI_API_KEY", "fixture-not-a-secret");
  vi.stubEnv("INNGEST_EVENT_KEY", "fixture-not-a-secret");
  vi.stubEnv("INNGEST_SIGNING_KEY", "fixture-not-a-secret");
  state.pg = new PGlite({ extensions: { vector } });
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await state.pg.exec(readFileSync("drizzle/" + file, "utf8"));
});
afterAll(async () => {
  await state.pg?.close();
  vi.unstubAllEnvs();
});
describe("collection request reservation", () => {
  it("rejects invalid payloads before reserving a job", async () => {
    expect((await POST(request({ collectSources: "false" }))).status).toBe(400);
    expect((await state.pg!.query("select * from job_runs")).rows).toHaveLength(
      0,
    );
  });
  it("dispatches one processing-only job and prevents a duplicate active run", async () => {
    state.send.mockResolvedValue({ ids: ["fixture-event"] });
    expect((await POST(request({ collectSources: false }))).status).toBe(200);
    expect(state.send.mock.calls[0][0].data).toMatchObject({
      collectSources: false,
      requestedBy: "fixture",
    });
    expect((await state.pg!.query("select status from job_runs")).rows).toEqual(
      [{ status: "queued" }],
    );
    expect((await POST(request({}))).status).toBe(409);
    expect(state.send).toHaveBeenCalledTimes(1);
  });
  it("releases the reservation when dispatch fails", async () => {
    await state.pg!.query("update job_runs set status='completed'");
    state.send.mockRejectedValueOnce(new Error("private provider response"));
    expect((await POST(request({}))).status).toBe(503);
    expect(
      (
        await state.pg!.query(
          "select status from job_runs order by created_at desc limit 1",
        )
      ).rows,
    ).toEqual([{ status: "failed" }]);
    expect((await POST(request({}))).status).toBe(200);
  });
  it("blocks non-administrators before dispatch", async () => {
    state.role = "viewer";
    expect((await POST(request({}))).status).toBe(403);
    state.role = "admin";
  });
});
