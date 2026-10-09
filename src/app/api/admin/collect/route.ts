import { z } from "zod";
import { input } from "@/lib/security";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import {
  endpoint,
  requireAdmin,
  rateLimit,
  audit,
  ApiError,
} from "@/lib/security";
import { inngest } from "@/lib/jobs";
import { recoverStalledJob } from "@/lib/pipeline-lifecycle";
export const POST = endpoint(async (req) => {
  const u = await requireAdmin();
  await rateLimit("collect:" + u.id);
  if (!process.env.INNGEST_EVENT_KEY || !process.env.INNGEST_SIGNING_KEY)
    throw new ApiError(
      503,
      "Background collection is not configured. Connect Inngest and configure its event and signing keys before starting collection.",
    );
  if (!process.env.GEMINI_API_KEY)
    throw new ApiError(
      503,
      "AI analysis is not configured. Add GEMINI_API_KEY before starting collection.",
    );
  const body = await input(
    req,
    z.object({
      collectSources: z.boolean().optional(),
      recoverJobId: z.string().min(1).max(200).optional(),
    }),
  );
  if (body.recoverJobId) {
    if (!(await recoverStalledJob(body.recoverJobId)))
      throw new ApiError(
        409,
        "This run is still active or has already finished. Refresh its status before restarting.",
      );
    await audit(u.id, "pipeline.recovered", { jobId: body.recoverJobId });
  }
  const jobId = randomUUID();
  const reservation = await db().execute(
    sql`insert into job_runs(id,job,status) values(${jobId},'daily-radar','queued') on conflict do nothing returning id`,
  );
  if (!reservation.rows.length)
    throw new ApiError(
      409,
      "A collection run is already active. Follow its progress before starting another.",
    );
  let event;
  try {
    event = await inngest.send({
      name: "painradar/collect.requested",
      data: {
        jobId,
        requestedBy: u.id,
        collectSources: body.collectSources !== false,
      },
    });
  } catch {
    await db().execute(
      sql`update job_runs set status='failed',error='Event dispatch failed',finished_at=now() where id=${jobId}`,
    );
    throw new ApiError(
      503,
      "Unable to dispatch collection. Check Inngest configuration.",
    );
  }
  await audit(u.id, "pipeline.triggered");
  return Response.json({ ok: true, ids: event.ids });
});
