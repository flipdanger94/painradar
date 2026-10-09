import { sourceIds, sourceNames, type SourceId } from "@/lib/source-catalog";
import Link from "next/link";
import { ArrowUpRight, Radio } from "lucide-react";
import { Text } from "@/components/language-provider";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { databaseReady } from "@/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  listSignals,
  signalFilters,
  signalPageHref,
  signalStates,
  signalStateLabels,
} from "@/lib/signals";
import { serverTranslation } from "@/lib/i18n/server";
export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // A page can execute alongside its parent layout; guard before reading data.
  if (databaseReady() && !(await getSession())) redirect("/login");
  const filters = signalFilters(await searchParams);
  const [data, t] = await Promise.all([
    listSignals(filters),
    serverTranslation(),
  ]);
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">
            <Text value="ORIGINAL CONVERSATIONS" />
          </div>
          <h1>
            <Text value="Signals" />
          </h1>
          <p>
            <Text value="Read the original discussions and follow how each signal is processed." />
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/sources">
            <Text value="Data sources" />
          </Link>
        </Button>
      </div>
      <form className="filters signal-filters" role="search">
        <input
          name="q"
          aria-label={t("Search signals")}
          placeholder={t("Search signals")}
          defaultValue={filters.q}
          maxLength={200}
        />
        <select
          name="source"
          aria-label={t("Source")}
          defaultValue={filters.source}
        >
          <option value="">{t("All sources")}</option>
          {sourceIds.map((id) => (
            <option key={id} value={id}>
              {sourceNames[id]}
            </option>
          ))}
        </select>
        <select
          name="state"
          aria-label={t("Processing state")}
          defaultValue={filters.state}
        >
          <option value="">{t("All processing states")}</option>
          {signalStates.map((state) => (
            <option key={state} value={state}>
              {t(signalStateLabels[state])}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm">
          <Text value="Apply filters" />
        </Button>
        <Link className="text-link" href="/app/signals">
          <Text value="Reset" />
        </Link>
      </form>
      <div className="signal-list-heading">
        <p>
          <strong>{data.total}</strong> <Text value="Signals" />
        </p>
        <p>
          <Text value="A collected signal is evidence, not a validated opportunity." />
        </p>
      </div>
      {data.rows.length ? (
        <div className="signal-list">
          {data.rows.map((signal) => (
            <article className="signal-item" key={signal.id}>
              <div className="signal-item-meta">
                <span className="badge">
                  {sourceNames[signal.source as SourceId] || signal.source}
                </span>
                <span className={`badge signal-state-${signal.state}`}>
                  <Text value={signalStateLabels[signal.state]} />
                </span>
                <span>{signal.language.toUpperCase()}</span>
                <time dateTime={signal.publishedAt.toISOString()}>
                  {signal.publishedAt.toISOString().slice(0, 10)}
                </time>
              </div>
              <h2>
                <a href={signal.url} target="_blank" rel="noopener noreferrer">
                  {signal.title}
                  <ArrowUpRight size={17} />
                </a>
              </h2>
              <p>
                {signal.excerpt}
                {signal.excerpt.length === 240 ? "…" : ""}
              </p>
              <div className="signal-author">
                <Radio size={13} />
                {signal.author}
                {signal.source === "stackexchange" && signal.license && (
                  <span>
                    <Text value="License" />: {signal.license}
                  </span>
                )}
                <a href={signal.url} target="_blank" rel="noopener noreferrer">
                  <Text value="Read original discussion" /> ↗
                </a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            databaseReady()
              ? "No signals match these filters."
              : "Setup required"
          }
          description={
            databaseReady()
              ? "Try another source or search phrase."
              : "Connect source collection to see original signals here."
          }
          action={{
            href: databaseReady() ? "/app/signals" : "/app/sources",
            label: databaseReady() ? "Reset" : "Data sources",
          }}
        />
      )}
      {data.pages > 1 && (
        <nav className="signal-pagination" aria-label={t("Signal pages")}>
          <div>
            {data.page > 1 && (
              <Link
                className="text-link"
                href={signalPageHref(filters, data.page - 1)}
              >
                <Text value="Previous" />
              </Link>
            )}
          </div>
          <span>
            <Text value="Page" /> {data.page} / {data.pages}
          </span>
          <div>
            {data.page < data.pages && (
              <Link
                className="text-link"
                href={signalPageHref(filters, data.page + 1)}
              >
                <Text value="Next" />
              </Link>
            )}
          </div>
        </nav>
      )}
    </>
  );
}
