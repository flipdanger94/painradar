import { eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  opportunities,
  watchlists,
  watchlistItems,
  reports,
} from "@/db/schema";
export async function workspaceSaved(id: string) {
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
    .where(eq(watchlists.workspaceId, id))
    .orderBy(desc(watchlistItems.createdAt));
}
export async function generateWorkspaceReports(
  workspaceId?: string,
  day?: string,
) {
  const ws = await db().execute(
    sql`select w.id from workspaces w join teams t on t.id=w.team_id where agency_active(t.owner_id) ${workspaceId ? sql`and w.id=${workspaceId}::uuid` : sql``}`,
  );
  const periods = await db()
    .select()
    .from(reports)
    .where(day ? eq(reports.endDay, day) : undefined)
    .orderBy(desc(reports.endDay))
    .limit(30);
  for (const w of ws.rows) {
    const wid = String(w.id);
    for (const report of periods) {
      const content = await db().execute(
        sql`select o.id,left(o.title,200) as title,left(o.summary,1000) as summary,o.industry,s.score,s.mentions,s.velocity,s.confidence,p.score as previous_score from watchlists wl join watchlist_items wi on wi.watchlist_id=wl.id join opportunities o on o.id=wi.opportunity_id join opportunity_snapshots s on s.opportunity_id=o.id and s.day=${report.endDay}::date left join opportunity_snapshots p on p.opportunity_id=o.id and p.day=${report.startDay}::date where wl.workspace_id=${wid}::uuid and wi.created_at<(${report.endDay}::date+interval '1 day') order by s.score desc,o.id limit 500`,
      );
      if (!content.rows.length) continue;
      await db().execute(
        sql`select create_workspace_report(${wid}::uuid,${report.period},${report.startDay}::date,${report.endDay}::date,${JSON.stringify(content.rows)}::jsonb)`,
      );
    }
  }
}
