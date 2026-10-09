import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
const state = vi.hoisted(() => ({
  pg: undefined as PGlite | undefined,
  handlers: new Map<
    string,
    {
      handler: (context: unknown) => Promise<unknown>;
      failure: (context: unknown) => Promise<unknown>;
    }
  >(),
}));
vi.mock("@/db", () => ({
  db: () => drizzle(state.pg!),
  databaseReady: () => true,
}));
vi.mock("inngest", () => ({
  Inngest: class {
    createFunction(
      opts: { id: string; onFailure: (context: unknown) => Promise<unknown> },
      _trigger: unknown,
      handler: (context: unknown) => Promise<unknown>,
    ) {
      state.handlers.set(opts.id, { handler, failure: opts.onFailure });
      return {};
    }
  },
}));
import "@/lib/jobs";
beforeAll(async () => {
  state.pg = new PGlite({ extensions: { vector } });
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await state.pg.exec(readFileSync("drizzle/" + file, "utf8"));
});
afterAll(async () => state.pg?.close());
describe("durable pipeline lifecycle", () => {
  it("keeps one cron job ID across replays without an event ID and marks the same job failed", async () => {
    const cache = new Map<string, unknown>();
    const context = {
      event: { data: {} },
      runId: "stable-cron-run",
      step: {
        run: async (name: string, callback: () => Promise<unknown>) => {
          if (name === "sources") throw new Error("test replay boundary");
          if (cache.has(name)) return cache.get(name);
          const value = await callback();
          cache.set(name, value);
          return value;
        },
      },
    };
    const worker = state.handlers.get("daily-radar")!;
    await expect(worker.handler(context)).rejects.toThrow(
      "test replay boundary",
    );
    await expect(worker.handler(context)).rejects.toThrow(
      "test replay boundary",
    );
    const jobs = await state.pg!.query(
      "select id,status,progress from job_runs",
    );
    expect(jobs.rows).toHaveLength(1);
    expect(jobs.rows[0]).toMatchObject({
      id: "stable-cron-run",
      status: "running",
      progress: { stage: "collect", done: 0 },
    });
    await worker.failure({
      event: {
        data: {
          event: { data: {} },
          run_id: "stable-cron-run",
          error: { message: "private provider body" },
        },
      },
    });
    expect((await state.pg!.query("select status from job_runs")).rows).toEqual(
      [{ status: "failed" }],
    );
    const run = vi.fn();
    expect(await worker.handler({ ...context, step: { run } })).toEqual({
      skipped: true,
    });
    expect(run).not.toHaveBeenCalled();
  });
  it("does not overwrite a recovered job when a late failure callback arrives", async () => {
    await state.pg!.query(
      "update job_runs set error='recovered by admin' where id='stable-cron-run'",
    );
    await state.handlers
      .get("daily-radar")!
      .failure({
        event: {
          data: {
            event: { data: { jobId: "stable-cron-run" } },
            run_id: "another-run",
            error: { message: "late failure" },
          },
        },
      });
    expect((await state.pg!.query("select error from job_runs")).rows).toEqual([
      { error: "recovered by admin" },
    ]);
  });
});
