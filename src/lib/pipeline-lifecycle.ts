import { db } from "@/db";
import { sql } from "drizzle-orm";
export const STALLED_AFTER_MS = 60 * 60 * 1000;
export const STALLED_ERROR =
  "Processing stopped after an hour without progress. Restart processing to continue the queue.";
export function stalledJob(
  job: {
    status: string;
    createdAt: Date;
    progress: { updatedAt: string } | null;
  },
  now = Date.now(),
) {
  const last = job.progress?.updatedAt
    ? new Date(job.progress.updatedAt).getTime()
    : job.createdAt.getTime();
  return (
    ["queued", "running"].includes(job.status) &&
    Number.isFinite(last) &&
    now - last >= STALLED_AFTER_MS
  );
}
export async function recoverStalledJob(id: string) {
  const result = await db().execute(
    sql`update job_runs set status='failed',finished_at=now(),error=${STALLED_ERROR} where id=${id} and job='daily-radar' and status in ('queued','running') and coalesce((progress->>'updatedAt')::timestamptz,created_at)<=now()-interval '1 hour' returning id`,
  );
  return result.rows.length > 0;
}
