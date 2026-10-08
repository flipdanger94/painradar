import { Text } from "@/components/language-provider";

import { requireWorkspace } from "@/lib/tenancy";
import { workspaceSaved } from "@/lib/workspace-data";
import { TrackEvent } from "@/components/track-event";
import { eq } from "drizzle-orm";
import { competitorResearch } from "@/db/schema";
import { CompetitorResults, MarketGap } from "@/components/competitor-results";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  opportunity,
  evidence,
  snapshots,
  savedOpportunities,
} from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { ApiError } from "@/lib/security";
import { openOpportunity } from "@/lib/access";
import { plans } from "@/lib/plans";
import { competitorEvidence } from "@/lib/competitors";
import { SaveButton, MvpButton, EvidenceLink } from "@/components/actions";
import { GrowthChart } from "@/components/growth-chart";
import { EmptyState } from "@/components/empty-state";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { id } = await params;
  const o = await opportunity(id);
  if (!o) notFound();
  const session = await getSession();
  if (!session)
    return (
      <EmptyState
        title="Log in to view the evidence"
        action={{ href: "/login", label: "Log in" }}
      />
    );
  const context = (await searchParams).workspace;
  const workspace = context
    ? await requireWorkspace(context, session.user.id)
    : null;
  let plan;
  try {
    plan = workspace
      ? ("agency" as const)
      : await openOpportunity(session.user.id, o.id);
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    return (
      <EmptyState
        title="Daily opportunity limit reached"
        description="Free includes five unique opportunity opens per day."
        action={{ href: "/pricing", label: "Compare plans" }}
      />
    );
  }
  const [signals, history, saved, competitors] = await Promise.all([
    evidence(o.clusterId),
    snapshots(o.id, plans[plan].history),
    workspace
      ? workspaceSaved(workspace.id)
      : savedOpportunities(session.user.id),
    competitorEvidence(o.clusterId),
  ]);
  if (!workspace)
    await db().execute(
      sql`update watchlist_items wi set last_viewed_at=now(),last_viewed_score=${o.score} from watchlists w where w.id=wi.watchlist_id and w.user_id=${session.user.id} and wi.opportunity_id=${o.id}::uuid`,
    );
  const researched = ["founder", "agency"].includes(plan)
    ? (
        await db()
          .select()
          .from(competitorResearch)
          .where(eq(competitorResearch.opportunityId, o.id))
      )[0]
    : null;
  const a = o.analysis;
  const workarounds = Array.isArray(a.workarounds)
    ? (a.workarounds as { description: string; evidenceIds: string[] }[])
    : [];
  return (
    <>
      <TrackEvent
        event="opportunity_opened"
        properties={{ opportunityId: o.id, workspaceId: workspace?.id }}
      />
      {workspace && (
        <a className="text-link" href={"/app/workspaces/" + workspace.id}>
          ← {workspace.name}
        </a>
      )}
      <div className="page-title">
        <div>
          <div className="eyebrow">
            {o.industry} · {o.status}
          </div>
          <h1>{o.title}</h1>
          <p>{o.audience}</p>
        </div>
        {workspace?.role !== "viewer" && (
          <SaveButton
            id={o.id}
            workspaceId={workspace?.id}
            saved={saved.some((s) => s.opportunity.id === o.id)}
          />
        )}
      </div>
      <div className="metrics">
        {[
          ["Opportunity Score", o.score + "/100", "Unknown inputs score zero"],
          ["Confidence", o.confidence, "Independent authors & freshness"],
          ["Mentions", o.mentions, "Observed source signals"],
          [
            "7d / 30d growth",
            (o.growth7d === null ? "—" : o.growth7d + "%") +
              " / " +
              (o.growth30d === null ? "—" : o.growth30d + "%"),
            "Equal prior-period comparison",
          ],
        ].map(([t, v, f]) => (
          <div className="metric" key={t}>
            <div className="metric-label">{t}</div>
            <div className="metric-value">{v}</div>
            <div className="metric-foot">{f}</div>
          </div>
        ))}
      </div>
      <div className="detail-grid">
        <div>
          <section className="panel detail-block">
            <span className="badge">AI inference · linked evidence below</span>
            <h2 style={{ marginTop: 20 }}>
              <Text value={"The problem"} />
            </h2>
            <p>{o.summary}</p>
            <h2>
              <Text value={"Who experiences it?"} />
            </h2>
            <p>{o.audience}</p>
            <h2>
              <Text value={"Observed growth"} />
            </h2>
            <GrowthChart rows={history} />
          </section>
          <section className="panel">
            <div className="panel-title">
              <h2>
                <Text value={"Evidence"} />
              </h2>
              <span className="badge">FACTS · ORIGINAL SOURCES</span>
            </div>
            {signals.map((s) => (
              <article
                className="evidence-card"
                id={"signal-" + s.id}
                key={s.id}
              >
                <div className="card-meta">
                  <span>{s.source}</span>
                  <span>{s.author}</span>
                  <time>{s.publishedAt.toISOString().slice(0, 10)}</time>
                  <span>{s.engagement} engagement</span>
                </div>
                <h3 style={{ marginTop: 12 }}>{s.title}</h3>
                <blockquote>
                  {s.content.slice(0, 350)}
                  {s.content.length > 350 ? "…" : ""}
                </blockquote>
                <EvidenceLink url={s.url} id={s.id} />
              </article>
            ))}
          </section>
          <section className="panel detail-block">
            <span className="badge">AI inference</span>
            <h2 style={{ marginTop: 18 }}>
              <Text value={"Commercial intent"} />
            </h2>
            <p>
              {typeof a.commercialIntent === "string"
                ? a.commercialIntent
                : "Not enough evidence yet."}
            </p>
            <h2>
              <Text value={"Existing workarounds"} />
            </h2>
            {workarounds.length ? (
              workarounds.map((w, i) => (
                <div key={i}>
                  <p>{w.description}</p>
                  <div className="card-meta">
                    {w.evidenceIds.map((id) => (
                      <a className="text-link" href={"#signal-" + id} key={id}>
                        Evidence ↗
                      </a>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p>
                <Text value={"Not enough evidence yet."} />
              </p>
            )}
          </section>
          <section className="panel detail-block">
            <span className="badge">
              RESEARCH LEADS · NOT VERIFIED COMPETITORS
            </span>
            <h2 style={{ marginTop: 18 }}>
              <Text value={"Existing solutions"} />
            </h2>
            {competitors.length ? (
              competitors.map((c) => (
                <p key={c.url}>
                  <a
                    className="text-link"
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {c.url} ↗
                  </a>{" "}
                  ·{" "}
                  <a
                    href={c.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Text value={"Source"} />
                  </a>
                  <br />
                  Pricing, positioning, advantages and complaints: Not enough
                  data.
                </p>
              ))
            ) : (
              <p>Not enough data. No competitors are invented.</p>
            )}
            {researched && (
              <>
                <span className="badge">
                  AI RESEARCH · CITED PUBLIC SOURCES
                </span>
                <CompetitorResults
                  results={researched.results}
                  displayedEvidenceIds={signals.map((s) => s.id)}
                />
              </>
            )}
            <p className="text-small">
              Live competitor web research is unavailable in this Gemini
              configuration. Existing cited research remains available.
            </p>
            <h2>
              <Text value={"Market gap"} />
            </h2>
            <MarketGap results={researched?.results || []} />
            {researched && (
              <p className="text-small">
                Research sampled on{" "}
                {researched.researchedAt.toISOString().slice(0, 10)}.
                Comparisons describe the signals supplied at that time.
              </p>
            )}
          </section>
        </div>
        <aside>
          <section className="panel detail-block">
            <h2>
              <Text value={"Score breakdown"} />
            </h2>
            {Object.entries(o.components as Record<string, number | null>).map(
              ([k, v]) => (
                <div
                  className="report-row"
                  key={k}
                  style={{ padding: "10px 0", fontSize: 11 }}
                >
                  <span>{k.replace(/([A-Z])/g, " $1")}</span>
                  <span>{v === null ? "Unknown" : Math.round(v) + "/100"}</span>
                </div>
              ),
            )}
            <p className="text-small" style={{ marginTop: 15 }}>
              Unknown values contribute zero. This is a conservative evidence
              score, not a revenue forecast.
            </p>
          </section>
          <section className="panel detail-block">
            <span className="badge">HYPOTHESIS · REQUIRES VALIDATION</span>
            <h2 style={{ marginTop: 18 }}>
              <Text value={"Your first MVP"} />
            </h2>
            {o.mvp && ["founder", "agency"].includes(plan) ? (
              Object.entries(o.mvp)
                .filter(([k]) => k !== "evidenceIds")
                .map(([k, v]) => (
                  <div key={k}>
                    <h3 className="text-small">
                      {k.replace(/([A-Z])/g, " $1")}
                    </h3>
                    <p>{Array.isArray(v) ? v.join("\n") : String(v)}</p>
                  </div>
                ))
            ) : (
              <p>
                Generate an evidence-linked solution hypothesis, scope, pricing
                experiment, acquisition plan, and risks.
              </p>
            )}
            {workspace?.role !== "viewer" && (
              <MvpButton id={o.id} workspaceId={workspace?.id} />
            )}
          </section>
          <section className="panel detail-block">
            <h2>
              <Text value={"Source distribution"} />
            </h2>
            {Object.entries(
              signals.reduce<Record<string, number>>(
                (m, s) => ({ ...m, [s.source]: (m[s.source] || 0) + 1 }),
                {},
              ),
            ).map(([s, c]) => (
              <p key={s}>
                {s}: {c} displayed signals
              </p>
            ))}
            <h2>
              <Text value={"Risks"} />
            </h2>
            {Array.isArray(a.risks) ? (
              a.risks.map((r, i) => <p key={i}>{String(r)}</p>)
            ) : (
              <p>
                <Text value={"Not enough evidence yet."} />
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
