import { languageCodes, languageLabels } from "@/lib/language-options";
import { industries } from "@/lib/taxonomy";
import { getSession } from "@/lib/auth";
import { requireWorkspace } from "@/lib/tenancy";
import { listOpportunities, type Filters } from "@/lib/queries";
import { OpportunityCard } from "@/components/opportunity-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Filters & { workspace?: string }>;
}) {
  const f = await searchParams;
  const session = await getSession();
  const workspace =
    f.workspace && session
      ? (await requireWorkspace(f.workspace, session.user.id)).id
      : undefined;
  const os = await listOpportunities(f);
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">WHERE THE SIGNAL IS GETTING LOUDER</div>
          <h1>Trending opportunities</h1>
          <p>Ranked by evidence. Growth measured against prior periods.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/api/export">Export CSV ↗</a>
        </Button>
      </div>
      <form className="filters">
        {workspace && (
          <input type="hidden" name="workspace" value={workspace} />
        )}
        <input
          name="q"
          aria-label="Search"
          placeholder="Search a problem or audience"
          defaultValue={f.q}
          maxLength={200}
        />
        <input
          name="industry"
          aria-label="Industry"
          placeholder="Any industry"
          list="industry-options"
          defaultValue={f.industry}
        />
        <datalist id="industry-options">
          {industries.map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
        <select name="source" aria-label="Source" defaultValue={f.source || ""}>
          <option value="">All sources</option>
          <option value="hn">Hacker News</option>
          <option value="github">GitHub Issues</option>
          <option value="reddit">Reddit</option>
        </select>
        <select
          name="confidence"
          aria-label="Confidence"
          defaultValue={f.confidence || ""}
        >
          <option value="">All confidence levels</option>
          {["Low", "Medium", "High"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          name="score"
          aria-label="Minimum score"
          defaultValue={f.score || ""}
        >
          <option value="">Any score</option>
          <option value="40">Score 40+</option>
          <option value="60">Score 60+</option>
          <option value="80">Score 80+</option>
        </select>
        <select
          name="range"
          aria-label="Time range"
          defaultValue={f.range || ""}
        >
          <option value="">All time</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
        <input
          name="audience"
          aria-label="Audience"
          placeholder="Any audience"
          defaultValue={f.audience}
        />
        <select
          name="language"
          aria-label="Evidence language"
          defaultValue={f.language || ""}
        >
          <option value="">All languages</option>
          {languageCodes.map((code) => (
            <option value={code} key={code}>
              {languageLabels[code]}
            </option>
          ))}
        </select>
        <input
          name="growth"
          type="number"
          min="-100"
          max="10000"
          aria-label="Minimum 7 day growth"
          placeholder="Min. 7d growth %"
          defaultValue={f.growth}
        />
        <select
          name="competition"
          aria-label="Competition data"
          defaultValue={f.competition || ""}
        >
          <option value="">Any competition data</option>
          <option value="known">Verified competition gap only</option>
        </select>
        <Button type="submit" size="sm">
          Apply filters
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href="/app/trending">Reset</a>
        </Button>
      </form>
      <p className="text-small muted">
        {os.length} opportunities · Missing data is never treated as confirmed
        demand.
      </p>
      {os.length ? (
        <div className="opportunity-grid">
          {os.map((o) => (
            <OpportunityCard o={o} key={o.id} workspaceId={workspace} />
          ))}
        </div>
      ) : (
        <div className="panel">
          <EmptyState />
        </div>
      )}
    </>
  );
}
