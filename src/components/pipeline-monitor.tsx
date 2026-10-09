"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  RefreshCw,
  Radio,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { PipelineStatus, PipelineStage } from "@/lib/pipeline-status";
import { useTranslation } from "./language-provider";
const stages: [PipelineStage, string][] = [
  ["collect", "Collecting sources"],
  ["embed", "Creating embeddings"],
  ["group", "Checking related signals"],
  ["analyze", "Analyzing evidence"],
  ["publish", "Publishing results"],
];
export function PipelineMonitor({
  initial,
  admin = false,
}: {
  initial: PipelineStatus | null;
  admin?: boolean;
}) {
  const t = useTranslation();
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    let controller: AbortController | undefined;
    async function refresh() {
      if (document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      try {
        const r = await fetch("/api/pipeline/status", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!r.ok) throw Error();
        const value = await r.json();
        if (live) {
          setData(value);
          setError("");
        }
      } catch (e) {
        if (live && !(e instanceof Error && e.name === "AbortError"))
          setError(t("Data is not available. Try refreshing."));
      }
    }
    void refresh();
    const timer = setInterval(refresh, 10000);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      live = false;
      clearInterval(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visible);
    };
  }, [t]);
  if (!data) return <section className="notice">{t("Setup required")}</section>;
  const running =
    data.job?.status === "running" || data.job?.status === "queued";
  const c = data.counts;
  const progress = data.job?.progress;
  const index = progress
    ? stages.findIndex((s) => s[0] === progress.stage)
    : -1;
  async function start(collectSources: boolean) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectSources }),
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error || t("Failed"));
      const status = await fetch("/api/pipeline/status", { cache: "no-store" });
      if (status.ok) setData(await status.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="pipeline-monitor" aria-label={t("Collection monitor")}>
      <div className="pipeline-heading">
        <div>
          <div className="eyebrow">
            <Activity size={14} />
            {t("Live pipeline")}
          </div>
          <h2>{t("Collection monitor")}</h2>
          <p>
            {t("Collected signals and AI conclusions are different stages.")}
          </p>
        </div>
        <span className={`pipeline-status ${data.job?.status || "idle"}`}>
          {running ? (
            <Activity size={15} />
          ) : data.job?.status === "failed" ? (
            <AlertCircle size={15} />
          ) : (
            <CheckCircle2 size={15} />
          )}{" "}
          {t(
            data.job?.status === "queued"
              ? "Queued"
              : running
                ? "Running"
                : data.job?.status === "completed"
                  ? "Completed"
                  : data.job?.status === "failed"
                    ? "Failed"
                    : "Not started",
          )}
        </span>
      </div>
      <div className="pipeline-stats">
        {[
          ["Signals", c.signals, Radio],
          ["Embeddings ready", c.embedded, Sparkles],
          ["Waiting for embeddings", c.queued, Activity],
          ["Pain clusters", c.clusters, Layers],
          ["Opportunities", c.opportunities, CheckCircle2],
        ].map(([label, value, Icon]) => {
          const I = Icon as typeof Activity;
          return (
            <div key={String(label)}>
              <I size={17} />
              <strong>{Number(value).toLocaleString()}</strong>
              <span>{t(String(label))}</span>
            </div>
          );
        })}
      </div>
      <ol className="pipeline-steps">
        {stages.map(([key, label], i) => (
          <li
            key={key}
            className={
              data.job?.status === "failed" && i === index
                ? "failed"
                : running && i === index
                  ? "current"
                  : data.job?.status === "completed" ||
                      (index >= 0 && i < index)
                    ? "finished"
                    : ""
            }
          >
            <span>{i + 1}</span>
            {t(label)}
          </li>
        ))}
      </ol>
      {running && progress && progress.total > 0 && (
        <div className="batch-progress">
          <div>
            <strong>
              {t(stages.find((s) => s[0] === progress.stage)?.[1] || "Running")}
            </strong>
            <span>
              {progress.done} / {progress.total}
            </span>
          </div>
          <progress
            max={progress.total}
            value={Math.min(progress.done, progress.total)}
            aria-label={t("Live pipeline")}
          />
        </div>
      )}
      <div className="pipeline-explanation" role="status">
        {data.job?.status === "failed" ? (
          <p>{t(data.job.error || "Failed")}</p>
        ) : data.job?.status === "completed" && c.queued > 0 ? (
          <p>
            {t(
              "One batch is complete; the remaining queue still needs processing.",
            )}
          </p>
        ) : null}
        {c.opportunities === 0 && (
          <p>
            {t(
              "No opportunities yet: a cluster needs similar evidence from at least 3 independent authors.",
            )}
          </p>
        )}
        <p>
          {t(
            "The queue is processed in bounded batches to respect Gemini quotas.",
          )}{" "}
          <strong>{data.limits.embeddings}</strong> /{" "}
          {t("Embeddings per batch")}
        </p>
        {c.awaitingGrouping > 0 && (
          <p>
            {c.awaitingGrouping} {t("Signals waiting for related evidence")}
          </p>
        )}
        {data.freeTier && (
          <p>
            {t(
              "Free-tier runs pause between AI requests; this may take several minutes.",
            )}
          </p>
        )}
      </div>
      {!data.configured && (
        <p role="alert">
          {t(
            "Complete the Gemini and background job setup in Admin to enable collection.",
          )}
        </p>
      )}
      {admin && (
        <div className="pipeline-actions">
          <button
            className="primary-action"
            disabled={
              running ||
              busy ||
              !data.configured ||
              (c.queued === 0 && !c.awaitingGrouping && c.clusters === 0)
            }
            onClick={() => start(false)}
          >
            {busy ? t("Working…") : t("Continue processing")}
            <ArrowRight size={16} />
          </button>
          <button
            className="secondary-action"
            disabled={running || busy || !data.configured}
            onClick={() => start(true)}
          >
            {t("Start collection")}
          </button>
          <p>
            {t(
              "This run only processes existing signals; it does not collect new source pages.",
            )}
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="error-message">
          {t(error)}
        </p>
      )}
      <div className="source-monitor-grid">
        {data.sources.map((s) => (
          <article key={s.id}>
            <div>
              <strong>{s.name}</strong>
              <span className="badge">
                {t(
                  s.id === "csv"
                    ? "CSV import"
                    : s.retryAt &&
                        new Date(s.retryAt).getTime() >
                          new Date(data.observedAt).getTime()
                      ? "Paused"
                      : !s.enabled
                        ? "Disabled"
                        : s.error
                          ? "Failed"
                          : s.health === "collecting"
                            ? "Partial crawl"
                            : s.health === "healthy"
                              ? "Healthy"
                              : "Not started",
                )}
              </span>
            </div>
            <p>
              <strong>{s.signals}</strong> {t("Signals")} · {s.pages}{" "}
              {t("Source pages saved")}
            </p>
            {s.id === "github" && (
              <p className="text-small">
                {t("GitHub reads only the repositories listed below.")}
              </p>
            )}
            <div className="scope-tags">
              {s.scopes.map((scope) => (
                <span key={scope}>{scope}</span>
              ))}
            </div>
            {s.error && <p role="alert">{t(s.error)}</p>}
            {s.retryAt && (
              <p className="text-small">
                {t("Retry after")}: {new Date(s.retryAt).toLocaleString()}
              </p>
            )}
          </article>
        ))}
      </div>
      <Link className="text-link signal-browse-link" href="/app/signals">
        {t("Browse all signals →")}
      </Link>
      {data.recent.length > 0 && (
        <details className="recent-signals">
          <summary>{t("Latest signals")}</summary>
          {data.recent.map((s, i) => (
            <a href={s.url} key={i} target="_blank" rel="noopener noreferrer">
              <span>{s.source}</span>
              {s.title}
              <ArrowRight size={13} />
            </a>
          ))}
        </details>
      )}
      <p className="monitor-updated">
        <RefreshCw size={12} />
        {t("Auto-refresh every 10 seconds")} · {t("Last updated")}{" "}
        <time dateTime={data.observedAt}>
          {new Date(data.observedAt).toISOString().slice(11, 19)} UTC
        </time>
      </p>
    </section>
  );
}
