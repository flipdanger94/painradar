import { getSession } from "@/lib/auth";
import { savedOpportunities } from "@/lib/queries";
import { OpportunityCard } from "@/components/opportunity-card";
import { SaveButton } from "@/components/actions";
import { EmptyState } from "@/components/empty-state";
export default async function Page() {
  const s = await getSession();
  const rows = s ? await savedOpportunities(s.user.id) : [];
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">KEEP THE RIGHT PROBLEMS CLOSE</div>
          <h1>Your watchlist</h1>
          <p>Score changes are compared with your last opportunity view.</p>
        </div>
      </div>
      {rows.length ? (
        <div className="opportunity-grid">
          {rows.map((r) => (
            <div key={r.opportunity.id}>
              <OpportunityCard
                o={r.opportunity}
                delta={
                  r.lastViewedScore === null
                    ? null
                    : r.opportunity.score - r.lastViewedScore
                }
              />
              <div style={{ marginTop: 8 }}>
                <SaveButton id={r.opportunity.id} saved />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel">
          <EmptyState
            title="Nothing saved yet."
            description="Save an opportunity to follow its score and evidence over time."
            action={{ href: "/app/trending", label: "Explore opportunities" }}
          />
        </div>
      )}
    </>
  );
}
