import { and, eq, isNull, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { industries } from "./taxonomy";
import { db } from "@/db";
import {
  sources,
  rawSignals,
  painClusters,
  clusterSignals,
  opportunities,
  reports,
} from "@/db/schema";
import { adapters, type SourceConfig, type RawSignal } from "./sources";
import { collectionCheckpointGuard } from "./sources/checkpoint";
import { collectionWindow, collectWindow } from "./sources/collection";
import { embedding, analyze, hash } from "./ai";
import {
  opportunityScore,
  confidence,
  growth,
  trendStatus,
  type ScoreComponents,
} from "./scoring";
export function canonicalUrl(value: string) {
  const u = new URL(value);
  u.hash = "";
  for (const key of [...u.searchParams.keys()])
    if (key.startsWith("utm_") || ["fbclid", "gclid"].includes(key))
      u.searchParams.delete(key);
  u.searchParams.sort();
  if (u.pathname !== "/") u.pathname = u.pathname.replace(/\/$/, "");
  return u.toString();
}
export function contentHash(signal: Pick<RawSignal, "title" | "content">) {
  return hash(
    (signal.title + " " + signal.content)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim(),
  );
}
export async function collectSourceBatch(
  sourceId: string,
  pageBudget?: number,
) {
  const source = (
    await db().select().from(sources).where(eq(sources.id, sourceId))
  )[0];
  if (!source || !source.enabled) return { inserted: 0, complete: true };
  const adapter = adapters[sourceId as keyof typeof adapters];
  if (!adapter) throw new Error("Unsupported source");
  let expectedState = source.collectionState;
  try {
    const config = source.config as SourceConfig;
    const initial = collectionWindow(
      adapter,
      config,
      source.collectionState,
      source.lastCollectedAt,
    );
    let count = 0;
    const result = await collectWindow(
      adapter,
      { ...config, pageBudget: pageBudget ?? config.pageBudget },
      initial,
      async (page, state, complete) => {
        const signals = page.records
          .map((record) => adapter.normalizeSignal(record))
          .filter((s): s is RawSignal => s !== null);
        if (signals.length) {
          const inserted = await db()
            .insert(rawSignals)
            .values(
              signals.map((s) => ({
                ...s,
                url: canonicalUrl(s.url),
                contentHash: contentHash(s),
                discoveredAt: undefined,
              })),
            )
            .onConflictDoNothing()
            .returning({ id: rawSignals.id });
          count += inserted.length;
        }
        const updated = await db()
          .update(sources)
          .set({
            health: page.warning
              ? "partial"
              : complete
                ? "healthy"
                : "collecting",
            lastCollectedAt: complete
              ? new Date(state.until)
              : source.lastCollectedAt,
            collectionState: complete ? null : state,
            lastError: page.warning || null,
          })
          .where(
            and(
              eq(sources.id, sourceId),
              eq(sources.enabled, true),
              collectionCheckpointGuard(
                source.config,
                expectedState,
                source.lastCollectedAt,
              ),
            ),
          )
          .returning({ id: sources.id });
        if (updated.length) expectedState = complete ? null : state;
        return updated.length > 0;
      },
    );
    return { inserted: count, ...result };
  } catch (e) {
    await db()
      .update(sources)
      .set({
        health: "error",
        lastError: e instanceof Error ? e.message : "Collection failed",
      })
      .where(
        and(
          eq(sources.id, sourceId),
          collectionCheckpointGuard(
            source.config,
            expectedState,
            source.lastCollectedAt,
          ),
        ),
      );
    throw e;
  }
}
export async function collectSource(sourceId: string) {
  return (await collectSourceBatch(sourceId)).inserted;
}
export async function createEmbeddings(jobId: string, signalId?: string) {
  const signals = await db()
    .select()
    .from(rawSignals)
    .where(
      and(
        isNull(rawSignals.embedding),
        isNull(rawSignals.retiredAt),
        isNull(rawSignals.duplicateOf),
        signalId ? eq(rawSignals.id, signalId) : undefined,
      ),
    )
    .orderBy(rawSignals.discoveredAt)
    .limit(40);
  for (const signal of signals) {
    const vector = await embedding(signal.title + "\n" + signal.content, jobId);
    await db()
      .update(rawSignals)
      .set({ embedding: vector })
      .where(and(eq(rawSignals.id, signal.id), isNull(rawSignals.retiredAt)));
  }
  return signals.length;
}
export async function deduplicateSignals() {
  const result = await db().execute(
    sql`with duplicates as (select s.id,(select t.id from raw_signals t where t.embedding is not null and t.duplicate_of is null and t.id<>s.id and (t.created_at,t.id)<(s.created_at,s.id) and (t.embedding <=> s.embedding)<0.025 order by t.embedding <=> s.embedding limit 1) as original from (select * from raw_signals where embedding is not null and processed_at is null and duplicate_of is null order by created_at,id limit 200) s) update raw_signals set duplicate_of=duplicates.original,processed_at=now() from duplicates where raw_signals.id=duplicates.id and duplicates.original is not null returning raw_signals.id`,
  );
  return result.rows.length;
}
const analysisSchema = z.object({
  isPain: z.boolean(),
  title: z.string(),
  summary: z.string(),
  category: z.string(),
  industry: z.enum(industries),
  audience: z.string(),
  keywords: z.array(z.string()),
  painIntensity: z.number().min(0).max(100),
  commercialIntent: z.string().nullable(),
  willingnessToPay: z.number().min(0).max(100).nullable(),
  workarounds: z.array(
    z.object({ description: z.string(), evidenceIds: z.array(z.string()) }),
  ),
  evidenceIds: z.array(z.string()),
  risks: z.array(z.string()),
});
export async function clusterSignalsJob(jobId: string, signalId?: string) {
  const pending = await db()
    .select()
    .from(rawSignals)
    .where(
      and(
        isNull(rawSignals.processedAt),
        isNull(rawSignals.duplicateOf),
        sql`${rawSignals.embedding} is not null`,
        signalId ? eq(rawSignals.id, signalId) : undefined,
      ),
    )
    .orderBy(rawSignals.discoveredAt)
    .limit(30);
  let created = 0;
  for (const seed of pending) {
    const assigned = await db()
      .select()
      .from(clusterSignals)
      .where(eq(clusterSignals.signalId, seed.id))
      .limit(1);
    if (assigned.length) continue;
    const v = JSON.stringify(seed.embedding);
    const nearest = await db().execute(
      sql`select id from pain_clusters where embedding <=> ${v}::vector < 0.18 order by embedding <=> ${v}::vector limit 1`,
    );
    if (nearest.rows[0]) {
      await db()
        .insert(clusterSignals)
        .values({ clusterId: String(nearest.rows[0].id), signalId: seed.id })
        .onConflictDoNothing();
      await db()
        .update(rawSignals)
        .set({ processedAt: new Date() })
        .where(eq(rawSignals.id, seed.id));
      continue;
    }
    const similar = await db().execute(
      sql`select s.* from raw_signals s where s.duplicate_of is null and s.processed_at is null and s.embedding is not null and s.embedding <=> ${v}::vector < 0.18 and not exists(select 1 from cluster_signals cs where cs.signal_id=s.id) order by s.embedding <=> ${v}::vector limit 40`,
    );
    const authors = new Set(
      similar.rows.map((r) => String(r.source) + ":" + String(r.author)),
    );
    if (authors.size < 3) continue;
    const evidence = similar.rows.map((r) => ({
      id: String(r.id),
      title: r.title,
      content: String(r.content).slice(0, 4000),
      source: r.source,
      author: r.author,
    }));
    const analysis = await analyze(
      "pain_cluster",
      evidence,
      analysisSchema,
      jobId,
    );
    if (!analysis.isPain) {
      for (const row of similar.rows)
        await db()
          .update(rawSignals)
          .set({ processedAt: new Date() })
          .where(eq(rawSignals.id, String(row.id)));
      continue;
    }
    const ids = new Set(evidence.map((s) => s.id));
    if (
      !analysis.evidenceIds.length ||
      analysis.evidenceIds.some((id) => !ids.has(id)) ||
      analysis.workarounds.some(
        (w) =>
          !w.evidenceIds.length || w.evidenceIds.some((id) => !ids.has(id)),
      )
    )
      throw new Error("AI returned unsupported evidence IDs");
    const clusterId = seed.id;
    await db()
      .insert(painClusters)
      .values({
        id: clusterId,
        title: analysis.title,
        summary: analysis.summary,
        category: analysis.category,
        industry: analysis.industry,
        audience: analysis.audience,
        keywords: analysis.keywords,
        embedding: seed.embedding,
        analysis,
      })
      .onConflictDoNothing();
    for (const row of similar.rows) {
      await db()
        .insert(clusterSignals)
        .values({ clusterId, signalId: String(row.id) })
        .onConflictDoNothing();
      await db()
        .update(rawSignals)
        .set({ processedAt: new Date() })
        .where(eq(rawSignals.id, String(row.id)));
    }
    created++;
  }
  return created;
}
export async function analyzeClusters(jobId: string, clusterId?: string) {
  const clusters = await db()
    .select()
    .from(painClusters)
    .where(clusterId ? eq(painClusters.id, clusterId) : undefined)
    .limit(200);
  for (const c of clusters) {
    const evidence = await db()
      .select({
        id: rawSignals.id,
        title: rawSignals.title,
        content: rawSignals.content,
      })
      .from(clusterSignals)
      .innerJoin(rawSignals, eq(rawSignals.id, clusterSignals.signalId))
      .where(eq(clusterSignals.clusterId, c.id))
      .orderBy(desc(rawSignals.publishedAt))
      .limit(60);
    if (evidence.length < 3) continue;
    const analysis = await analyze(
      "pain_cluster",
      evidence.map((s) => ({ ...s, content: s.content.slice(0, 4000) })),
      analysisSchema,
      jobId,
    );
    const ids = new Set(evidence.map((s) => s.id));
    if (!analysis.isPain) continue;
    if (
      !analysis.evidenceIds.length ||
      analysis.evidenceIds.some((id) => !ids.has(id)) ||
      analysis.workarounds.some(
        (w) =>
          !w.evidenceIds.length || w.evidenceIds.some((id) => !ids.has(id)),
      )
    )
      throw new Error("Unsupported evidence IDs");
    await db()
      .update(painClusters)
      .set({
        analysis,
        title: analysis.title,
        summary: analysis.summary,
        category: analysis.category,
        industry: analysis.industry,
        audience: analysis.audience,
        keywords: analysis.keywords,
        updatedAt: new Date(),
      })
      .where(eq(painClusters.id, c.id));
  }
}
export async function calculateScores(clusterId?: string) {
  const clusters = await db()
    .select()
    .from(painClusters)
    .where(clusterId ? eq(painClusters.id, clusterId) : undefined);
  const now = Date.now();
  for (const c of clusters) {
    const signals = await db()
      .select({
        author: rawSignals.author,
        source: rawSignals.source,
        publishedAt: rawSignals.publishedAt,
      })
      .from(clusterSignals)
      .innerJoin(rawSignals, eq(rawSignals.id, clusterSignals.signalId))
      .where(
        and(eq(clusterSignals.clusterId, c.id), isNull(rawSignals.duplicateOf)),
      );
    if (new Set(signals.map((s) => s.source + ":" + s.author)).size < 3)
      continue;
    const count = (from: number, to: number) =>
      signals.filter((s) => {
        const age = (now - s.publishedAt.getTime()) / 86400000;
        return age >= from && age < to;
      }).length;
    const recent = count(0, 7),
      previous = count(7, 14),
      month = count(0, 30),
      lastMonth = count(30, 60);
    const g7 = growth(recent, previous),
      g30 = growth(month, lastMonth);
    const latest = Math.max(...signals.map((s) => s.publishedAt.getTime()));
    const a = c.analysis;
    const components: ScoreComponents = {
      frequency: Math.min(100, Math.log2(1 + month) * 14),
      velocity: g7 === null ? null : Math.max(0, Math.min(100, 50 + g7 / 2)),
      willingnessToPay:
        typeof a.willingnessToPay === "number" ? a.willingnessToPay : null,
      painIntensity:
        typeof a.painIntensity === "number" ? a.painIntensity : null,
      competitionGap: null,
      recency: Math.max(0, 100 - ((now - latest) / 86400000) * 5),
      sourceDiversity: Math.min(
        100,
        (new Set(signals.map((s) => s.source)).size / 3) * 100,
      ),
    };
    const conf = confidence(
      new Set(signals.map((s) => s.source + ":" + s.author)).size,
      new Set(signals.map((s) => s.source)).size,
      month / signals.length,
      signals.length,
    );
    const values = {
      clusterId: c.id,
      slug:
        c.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 75) +
        "-" +
        c.id.slice(0, 8),
      title: c.title,
      summary: c.summary,
      industry: c.industry,
      audience: c.audience,
      score: opportunityScore(components),
      confidence: conf,
      mentions: signals.length,
      growth7d: g7,
      growth30d: g30,
      status: trendStatus(g7, g30, (now - c.createdAt.getTime()) / 86400000),
      components,
      analysis: a,
      updatedAt: new Date(),
    };
    await db()
      .insert(opportunities)
      .values(values)
      .onConflictDoUpdate({ target: opportunities.clusterId, set: values });
  }
  return clusters.length;
}
export async function updateTrends() {
  await db().execute(
    sql`delete from trend_opportunities link using trends t,opportunities o where link.trend_id=t.id and link.opportunity_id=o.id and (t.title<>canonical_industry(o.industry) or canonical_industry(o.industry)='Other / unclear' or (select count(*) from opportunities p where canonical_industry(p.industry)=canonical_industry(o.industry))<2)`,
  );
  const r = await db().execute(
    sql`with groups as (select canonical_industry(industry) as industry from opportunities where canonical_industry(industry)<>'Other / unclear' group by canonical_industry(industry) having count(*)>=2), inserted as (insert into trends(slug,title,summary) select regexp_replace(lower(g.industry),'[^a-z0-9]+','-','g')||'-'||substr(md5(g.industry),1,12),g.industry,'Related evidence-backed opportunities in '||g.industry from groups g where not exists(select 1 from trends t where t.title=g.industry) on conflict(slug) do nothing returning id,title), targets as (select id,title from inserted union all select distinct on(t.title) t.id,t.title from trends t join groups g on g.industry=t.title order by title) insert into trend_opportunities(trend_id,opportunity_id) select t.id,o.id from targets t join opportunities o on canonical_industry(o.industry)=t.title on conflict do nothing returning opportunity_id`,
  );
  return r.rows.length;
}
export async function createDailySnapshots(
  day = new Date().toISOString().slice(0, 10),
) {
  const r = await db().execute(
    sql`select capture_daily_snapshots(${day}::date) as count`,
  );
  return Number(r.rows[0]?.count || 0);
}
export async function generateReports(
  endDay = new Date().toISOString().slice(0, 10),
) {
  for (const [period, days] of [
    ["daily", 1],
    ["weekly", 7],
    ["monthly", 30],
  ] as const) {
    const startDay = new Date(
      new Date(endDay + "T00:00:00Z").getTime() - days * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    const result = await db().execute(
      sql`select o.id,o.title,o.industry,s.score,s.mentions,s.velocity,s.confidence,s.rank,p.score as previous_score,p.mentions as previous_mentions,case when p.id is null then 'New' when s.score>p.score+5 then 'Accelerating' when s.score<p.score-5 then 'Declining' else 'Stable' end as status from opportunity_snapshots s join opportunities o on o.id=s.opportunity_id left join opportunity_snapshots p on p.opportunity_id=s.opportunity_id and p.day=${startDay}::date where s.day=${endDay}::date order by s.rank limit 20`,
    );
    await db()
      .insert(reports)
      .values({ period, startDay, endDay, content: result.rows })
      .onConflictDoNothing();
  }
}
