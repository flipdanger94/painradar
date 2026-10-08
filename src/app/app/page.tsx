import { Text } from "@/components/language-provider";
import { PipelineMonitor } from "@/components/pipeline-monitor";
import { pipelineStatus } from "@/lib/pipeline-status";
import Link from "next/link";
import { eq, desc, gt, gte, sql, and, isNull } from "drizzle-orm";
import { ScanLine } from "lucide-react";
import { databaseReady, db } from "@/db";
import { opportunities, radars, rawSignals } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { listOpportunities, savedOpportunities } from "@/lib/queries";
import { OpportunityCard } from "@/components/opportunity-card";
import { EmptyState } from "@/components/empty-state";
import { GrowthChart } from "@/components/growth-chart";
import { Button } from "@/components/ui/button";
export default async function Page() {
  const session = await getSession();
  const os = await listOpportunities({}, 6);
  let counts = { opportunities: 0, signals: 0, radars: 0, saved: 0 };
  if (databaseReady()) {
    const results = await Promise.all([
      db().$count(opportunities),
      db().$count(rawSignals),
      session
        ? db().$count(
            radars,
            and(eq(radars.userId, session.user.id), isNull(radars.workspaceId)),
          )
        : 0,
      session ? savedOpportunities(session.user.id) : [],
    ]);
    counts = {
      opportunities: results[0],
      signals: results[1],
      radars: results[2],
      saved: results[3].length,
    };
  }
  const [fastest, newToday, history] = databaseReady()
    ? await Promise.all([
        db()
          .select()
          .from(opportunities)
          .where(gt(opportunities.growth7d, 0))
          .orderBy(desc(opportunities.growth7d))
          .limit(3),
        db()
          .select()
          .from(opportunities)
          .where(
            gte(
              opportunities.createdAt,
              new Date(new Date().toISOString().slice(0, 10)),
            ),
          )
          .orderBy(desc(opportunities.score))
          .limit(6),
        db().execute(
          sql`select day,sum(mentions)::integer as mentions,avg(score)::real as score from opportunity_snapshots where day>=current_date-7 group by day order by day`,
        ),
      ])
    : [[], [], { rows: [] }];
  const chartRows = history.rows.map((r) => ({
    day: String(r.day),
    mentions: Number(r.mentions),
    score: Number(r.score),
  }));
  const status = await pipelineStatus();
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">
            <Text value={"YOUR MARKET, IN FOCUS"} />
          </div>
          <h1>
            <Text value={"Radar overview"} />
          </h1>
          <p>
            <Text
              value={
                "Follow real problems. Find where you can make a difference."
              }
            />
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/app/radars">
            <ScanLine size={14} />
            <Text value={"Create radar"} />
          </Link>
        </Button>
      </div>
      <PipelineMonitor
        initial={status}
        admin={session?.user.role === "admin"}
      />
      <div className="metrics">
        {[
          ["Opportunities", counts.opportunities, "Evidence-backed problems"],
          ["Signals collected", counts.signals, "Public conversations"],
          ["Active radars", counts.radars, "Your tracked interests"],
          ["Saved opportunities", counts.saved, "Your watchlist"],
        ].map(([label, value, foot]) => (
          <div className="metric" key={String(label)}>
            <div className="metric-label">
              <Text value={String(label)} />
            </div>
            <div className="metric-value">{databaseReady() ? value : "—"}</div>
            <div className="metric-foot">
              <Text value={String(foot)} />
            </div>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>
            <Text value={"Top opportunities"} />
          </h2>
          <Link className="text-link" href="/app/trending">
            <Text value={"View all ↗"} />
          </Link>
        </div>
        {os.length ? (
          <div className="opportunity-grid" style={{ padding: 20 }}>
            {os.map((o) => (
              <OpportunityCard o={o} key={o.id} />
            ))}
          </div>
        ) : (
          <EmptyState
            action={{ href: "/app/sources", label: "View source connections" }}
          />
        )}
      </section>
      <section className="panel detail-block">
        <h2>
          <Text value={"Market signal history"} />
        </h2>
        <GrowthChart rows={chartRows} />
      </section>
      <div className="mini-grid">
        <article>
          <div className="eyebrow">
            <Text value={"GROWTH, NOT GUESSWORK"} />
          </div>
          <h3>
            <Text value={"Fastest growing"} />
          </h3>
          {fastest.map((o) => (
            <p key={o.id}>
              <Link className="text-link" href={"/app/opportunities/" + o.id}>
                {o.title} · +{o.growth7d}%
              </Link>
            </p>
          ))}
          {!fastest.length && (
            <p>
              <Text
                value={"Not enough historical evidence to measure growth yet."}
              />
            </p>
          )}
        </article>
        <article>
          <div className="eyebrow">
            <Text value={"FRESH ON THE RADAR"} />
          </div>
          <h3>
            <Text value={"New today"} />
          </h3>
          {newToday.map((o) => (
            <p key={o.id}>
              <Link className="text-link" href={"/app/opportunities/" + o.id}>
                {o.title}
              </Link>
            </p>
          ))}
          {!newToday.length && (
            <p>
              <Text value={"No new evidence-backed opportunities today."} />
            </p>
          )}
        </article>
      </div>
    </>
  );
}
