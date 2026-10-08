import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { reports } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { userPlan } from "@/lib/security";
import { EmptyState } from "@/components/empty-state";
export default async function Page() {
  const s = await getSession();
  const plan = s ? await userPlan(s.user.id) : "free";
  if (!["founder", "agency"].includes(plan))
    return (
      <>
        <div className="page-title">
          <h1>Intelligence reports</h1>
        </div>
        <EmptyState
          title="Your market, over time."
          description="Daily, weekly, and monthly reports compare actual snapshots. Founder includes report access."
          action={{ href: "/pricing", label: "Compare plans" }}
        />
      </>
    );
  const rows = await db()
    .select()
    .from(reports)
    .orderBy(desc(reports.endDay))
    .limit(30);
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Intelligence reports</h1>
          <p>Based on real daily snapshots. No invented MRR or market size.</p>
        </div>
      </div>
      {rows.length ? (
        rows.map((r) => (
          <section className="panel detail-block" key={r.id}>
            <span className="badge">{r.period}</span>
            <h2 style={{ marginTop: 15 }}>
              {r.startDay} → {r.endDay}
            </h2>
            {Array.isArray(r.content) && r.content.length ? (
              r.content.map((row, i) => {
                const o = row as Record<string, unknown>;
                return (
                  <div className="report-row" key={i}>
                    <div>
                      <Link
                        className="text-link"
                        href={"/app/opportunities/" + o.id}
                      >
                        {String(o.title)}
                      </Link>
                      <p className="text-small">
                        {String(o.industry)} · {String(o.status)} ·{" "}
                        {String(o.confidence)} confidence
                      </p>
                    </div>
                    <div className="text-small">
                      Score {String(o.score)} · {String(o.mentions)} signals
                    </div>
                  </div>
                );
              })
            ) : (
              <p>Not enough evidence yet.</p>
            )}
          </section>
        ))
      ) : (
        <section className="panel">
          <EmptyState
            title="Reports start with history."
            description="The daily pipeline produces reports from observed snapshots. No report history has been collected yet."
          />
        </section>
      )}
    </>
  );
}
