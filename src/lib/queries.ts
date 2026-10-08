import { and, eq, asc, desc, sql, gte, ilike, or, inArray } from "drizzle-orm";
import { opportunityPageBoundary } from "./opportunity-pagination";
import type { PageCursor } from "./api-pagination";
import { databaseReady, db } from "@/db";
import {
  opportunities,
  rawSignals,
  clusterSignals,
  opportunitySnapshots,
  watchlists,
  watchlistItems,
} from "@/db/schema";
import { getSession } from "./auth";
import { embedding } from "./ai";
export type Opportunity = typeof opportunities.$inferSelect;
export interface Filters {
  q?: string;
  industry?: string;
  audience?: string;
  source?: string;
  score?: string;
  growth?: string;
  confidence?: string;
  language?: string;
  range?: string;
  competition?: string;
}
export async function listOpportunities(
  f: Filters = {},
  limit = 50,
  userId?: string,
  opportunityIds?: string[],
  after?: PageCursor,
) {
  if (!databaseReady()) return [];
  f = Object.fromEntries(
    Object.entries(f)
      .filter(([, v]) => typeof v === "string")
      .map(([k, v]) => [k, v.slice(0, 200)]),
  );
  const conditions = [];
  if (after) conditions.push(opportunityPageBoundary(after));
  if (opportunityIds)
    conditions.push(inArray(opportunities.id, opportunityIds));
  if (f.industry)
    conditions.push(
      sql`industry_matches(${opportunities.industry},${f.industry})`,
    );
  if (f.audience)
    conditions.push(ilike(opportunities.audience, "%" + f.audience + "%"));
  if (f.score)
    conditions.push(
      gte(
        opportunities.score,
        Math.min(100, Math.max(0, Number(f.score) || 0)),
      ),
    );
  if (f.growth)
    conditions.push(gte(opportunities.growth7d, Number(f.growth) || 0));
  if (f.confidence) conditions.push(eq(opportunities.confidence, f.confidence));
  if (f.range)
    conditions.push(
      gte(
        opportunities.updatedAt,
        new Date(
          Date.now() -
            Math.min(365, Math.max(1, Number(f.range) || 30)) * 86400000,
        ),
      ),
    );
  if (f.competition === "known")
    conditions.push(
      sql`${opportunities.components}->>'competitionGap' is not null`,
    );
  if (f.source || f.language)
    conditions.push(
      sql`exists(select 1 from cluster_signals cs join raw_signals s on s.id=cs.signal_id where cs.cluster_id=${opportunities.clusterId} ${f.source ? sql`and s.source=${f.source}` : sql``} ${f.language ? sql`and s.language=${f.language}` : sql``})`,
    );
  if (f.q) {
    const text = f.q.slice(0, 200);
    const authenticatedUser = userId || (await getSession())?.user.id;
    const vector =
      process.env.OPENAI_API_KEY && authenticatedUser
        ? await embedding(text, "search", authenticatedUser)
        : null;
    const v = JSON.stringify(vector);
    conditions.push(
      sql`(${opportunities.id} in (select o.id from opportunities o join pain_clusters c on c.id=o.cluster_id where to_tsvector('simple',o.title||' '||o.summary||' '||o.industry||' '||o.audience||' '||c.keywords::text) @@ plainto_tsquery('simple',${text}) ${vector ? sql`or c.embedding <=> ${v}::vector < 0.3` : sql``}))`,
    );
  }
  return db()
    .select()
    .from(opportunities)
    .where(and(...conditions))
    .orderBy(desc(opportunities.score), asc(opportunities.id))
    .limit(limit);
}
export async function opportunity(id: string) {
  if (!databaseReady()) return null;
  const condition = /^[0-9a-f-]{36}$/i.test(id)
    ? or(eq(opportunities.id, id), eq(opportunities.slug, id))
    : eq(opportunities.slug, id);
  const o = (
    await db().select().from(opportunities).where(condition).limit(1)
  )[0];
  return o || null;
}
export async function evidence(clusterId: string) {
  return db()
    .select({
      id: rawSignals.id,
      source: rawSignals.source,
      author: rawSignals.author,
      title: rawSignals.title,
      content: rawSignals.content,
      publishedAt: rawSignals.publishedAt,
      url: rawSignals.url,
      engagement: rawSignals.engagement,
    })
    .from(clusterSignals)
    .innerJoin(rawSignals, eq(rawSignals.id, clusterSignals.signalId))
    .where(eq(clusterSignals.clusterId, clusterId))
    .orderBy(desc(rawSignals.publishedAt))
    .limit(50);
}
export async function snapshots(id: string, days = 7) {
  return db()
    .select()
    .from(opportunitySnapshots)
    .where(
      and(
        eq(opportunitySnapshots.opportunityId, id),
        gte(
          opportunitySnapshots.day,
          new Date(Date.now() - days * 86400000).toISOString().slice(0, 10),
        ),
      ),
    )
    .orderBy(opportunitySnapshots.day);
}
export async function savedOpportunities(userId: string) {
  return db()
    .select({
      opportunity: opportunities,
      lastViewedScore: watchlistItems.lastViewedScore,
    })
    .from(watchlists)
    .innerJoin(watchlistItems, eq(watchlistItems.watchlistId, watchlists.id))
    .innerJoin(
      opportunities,
      eq(opportunities.id, watchlistItems.opportunityId),
    )
    .where(eq(watchlists.userId, userId))
    .orderBy(desc(watchlistItems.createdAt));
}
