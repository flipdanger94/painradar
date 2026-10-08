import { db, databaseReady } from "@/db";
import { jobRuns, sources } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { embeddingModel } from "./gemini";
import { PIPELINE_LIMITS } from "./analysis-batches";
export type PipelineStage =
  "collect" | "embed" | "group" | "analyze" | "publish" | "done";
export interface JobProgress {
  stage: PipelineStage;
  done: number;
  total: number;
  updatedAt: string;
}
export async function recordProgress(
  id: string,
  stage: PipelineStage,
  done: number,
  total: number,
) {
  await db()
    .update(jobRuns)
    .set({
      progress: { stage, done, total, updatedAt: new Date().toISOString() },
    })
    .where(eq(jobRuns.id, id));
}
export async function pipelineStatus() {
  if (!databaseReady()) return null;
  const [counts, jobs, sourceRows, sourceCounts, recent] = await Promise.all([
    db().execute(
      sql`select count(*)::int as signals,count(*) filter(where embedding is not null and embedding_model=${embeddingModel()})::int as embedded,count(*) filter(where retired_at is null and duplicate_of is null and (embedding is null or (embedding_model<>${embeddingModel()} and processed_at is null)))::int as queued,count(*) filter(where processed_at is not null)::int as processed,count(*) filter(where retired_at is null and duplicate_of is null and processed_at is null and embedding is not null and embedding_model=${embeddingModel()})::int as "awaitingGrouping",count(*) filter(where duplicate_of is not null)::int as duplicates,(select count(*)::int from pain_clusters) as clusters,(select count(*)::int from opportunities) as opportunities from raw_signals`,
    ),
    db()
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.job, "daily-radar"))
      .orderBy(desc(jobRuns.createdAt))
      .limit(1),
    db().select().from(sources),
    db().execute(
      sql`select source,count(*)::int as signals from raw_signals group by source`,
    ),
    db().execute(
      sql`select source,title,url,created_at from raw_signals where retired_at is null order by created_at desc,id desc limit 5`,
    ),
  ]);
  const job = jobs[0];
  return {
    observedAt: new Date().toISOString(),
    counts: counts.rows[0] as Record<string, number>,
    job: job
      ? {
          status: job.status,
          startedAt: job.createdAt.toISOString(),
          finishedAt: job.finishedAt?.toISOString() || null,
          progress: job.progress,
          error: job.error
            ? "Processing failed. Review the job in Inngest before restarting."
            : null,
        }
      : null,
    limits: {
      embeddings: PIPELINE_LIMITS.embeddings,
      seeds: PIPELINE_LIMITS.seeds,
    },
    configured:
      !!process.env.GEMINI_API_KEY &&
      !!process.env.INNGEST_EVENT_KEY &&
      !!process.env.INNGEST_SIGNING_KEY,
    sources: sourceRows.map((s) => ({
      id: s.id,
      name: s.name,
      enabled: s.enabled,
      health: s.health,
      error: s.lastError
        ? "Source request failed. Check access and configuration."
        : null,
      signals: Number(
        sourceCounts.rows.find((r) => r.source === s.id)?.signals || 0,
      ),
      completedThrough: s.lastCollectedAt?.toISOString() || null,
      pages: s.collectionState?.pages || 0,
      scopes:
        (
          s.config as {
            repositories?: string[];
            keywords?: string[];
            subreddits?: string[];
          }
        ).repositories ||
        (s.config as { keywords?: string[] }).keywords ||
        (s.config as { subreddits?: string[] }).subreddits ||
        [],
    })),
    recent: recent.rows.map((r) => ({
      source: String(r.source),
      title: String(r.title),
      url: String(r.url),
    })),
  };
}
export type PipelineStatus = NonNullable<
  Awaited<ReturnType<typeof pipelineStatus>>
>;
