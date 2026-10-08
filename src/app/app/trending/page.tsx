import { serverTranslation } from "@/lib/i18n/server";
import { Text } from "@/components/language-provider";
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
  const t = await serverTranslation();
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
          <div className="eyebrow">
            <Text value={"WHERE THE SIGNAL IS GETTING LOUDER"} />
          </div>
          <h1>
            <Text value={"Trending opportunities"} />
          </h1>
          <p>
            <Text
              value={
                "Ranked by evidence. Growth measured against prior periods."
              }
            />
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="/api/export">
            <Text value={"Export CSV ↗"} />
          </a>
        </Button>
      </div>
      <form className="filters">
        {workspace && (
          <input type="hidden" name="workspace" value={workspace} />
        )}
        <input
          name="q"
          aria-label={t("Search")}
          placeholder={t("Search a problem or audience")}
          defaultValue={f.q}
          maxLength={200}
        />
        <input
          name="industry"
          aria-label={t("Industry")}
          placeholder={t("Any industry")}
          list="industry-options"
          defaultValue={f.industry}
        />
        <datalist id="industry-options">
          {industries.map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
        <select
          name="source"
          aria-label={t("Source")}
          defaultValue={f.source || ""}
        >
          <option value="">
            <Text value={"All sources"} />
          </option>
          <option value="hn">Hacker News</option>
          <option value="github">GitHub Issues</option>
          <option value="reddit">Reddit</option>
        </select>
        <select
          name="confidence"
          aria-label={t("Confidence")}
          defaultValue={f.confidence || ""}
        >
          <option value="">
            <Text value={"All confidence levels"} />
          </option>
          {["Low", "Medium", "High"].map((v) => (
            <option key={v} value={v}>
              <Text value={v} />
            </option>
          ))}
        </select>
        <select
          name="score"
          aria-label={t("Minimum score")}
          defaultValue={f.score || ""}
        >
          <option value="">
            <Text value={"Any score"} />
          </option>
          <option value="40">
            <Text value={"Score 40+"} />
          </option>
          <option value="60">
            <Text value={"Score 60+"} />
          </option>
          <option value="80">
            <Text value={"Score 80+"} />
          </option>
        </select>
        <select
          name="range"
          aria-label={t("Time range")}
          defaultValue={f.range || ""}
        >
          <option value="">
            <Text value={"All time"} />
          </option>
          <option value="7">
            <Text value={"Last 7 days"} />
          </option>
          <option value="30">
            <Text value={"Last 30 days"} />
          </option>
          <option value="90">
            <Text value={"Last 90 days"} />
          </option>
        </select>
        <input
          name="audience"
          aria-label={t("Audience")}
          placeholder={t("Any audience")}
          defaultValue={f.audience}
        />
        <select
          name="language"
          aria-label={t("Evidence language")}
          defaultValue={f.language || ""}
        >
          <option value="">
            <Text value={"All languages"} />
          </option>
          {languageCodes.map((code) => (
            <option value={code} key={code}>
              <Text value={languageLabels[code]} />
            </option>
          ))}
        </select>
        <input
          name="growth"
          type="number"
          min="-100"
          max="10000"
          aria-label={t("Minimum 7 day growth")}
          placeholder={t("Min. 7d growth %")}
          defaultValue={f.growth}
        />
        <select
          name="competition"
          aria-label={t("Competition data")}
          defaultValue={f.competition || ""}
        >
          <option value="">
            <Text value={"Any competition data"} />
          </option>
          <option value="known">
            <Text value={"Verified competition gap only"} />
          </option>
        </select>
        <Button type="submit" size="sm">
          <Text value={"Apply filters"} />
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href="/app/trending">
            <Text value={"Reset"} />
          </a>
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
