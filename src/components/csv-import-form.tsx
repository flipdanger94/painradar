"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { parse } from "csv-parse/browser/esm/sync";
import { useTranslation } from "./language-provider";
import { Button } from "./ui/button";
export function CsvImportForm() {
  const t = useTranslation();
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    inserted: number;
    duplicates: number;
  } | null>(null);
  return (
    <section className="panel detail-block" id="csv-import">
      <h2>{t("CSV import")}</h2>
      <p>
        {t(
          "Import up to 200 records (500 KB). All rows are validated before saving.",
        )}
      </p>
      <p className="text-small">
        {t(
          "Columns: title, content, url, published_at; author is optional. Use ISO timestamps with a timezone, for example 2026-10-01T12:00:00Z.",
        )}
      </p>
      <a className="text-link" href="/templates/signals.csv" download>
        {t("Download CSV template")}
      </a>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          setResult(null);
          try {
            const r = await fetch("/api/admin/sources/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ csv, confirmed }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error || "Import failed.");
            setResult(d);
            setCsv("");
            setRows([]);
            setConfirmed(false);
            router.refresh();
          } catch (error) {
            setError(error instanceof Error ? error.message : "Import failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="csv-file">{t("Choose CSV file")}</label>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setCsv("");
            setRows([]);
            setConfirmed(false);
            setError("");
            setResult(null);
            if (!file) return;
            if (file.size > 500_000) {
              setError("CSV file is too large (maximum 500 KB).");
              return;
            }
            setBusy(true);
            try {
              const value = await file.text();
              const preview: Record<string, string>[] = parse(value, {
                bom: true,
                columns: true,
                skip_empty_lines: true,
                max_record_size: 40000,
              });
              if (!preview.length || preview.length > 200)
                throw new Error("CSV must contain between 1 and 200 records.");
              if (
                !["title", "content", "url", "published_at"].every(
                  (k) => k in preview[0],
                )
              )
                throw new Error(
                  "CSV requires title, content, url, published_at; author is optional.",
                );
              setCsv(value);
              setRows(preview);
            } catch (error) {
              setError(
                error instanceof Error && error.message.startsWith("CSV ")
                  ? error.message
                  : "CSV could not be parsed. Check quotes, commas and column names.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
        {rows.length > 0 && (
          <>
            <p>
              {t("Records in file")}: {rows.length}
            </p>
            <div className="csv-preview">
              {rows.slice(0, 5).map((row, i) => (
                <article className="signal-item" key={i}>
                  <strong>{row.title?.slice(0, 160)}</strong>
                  <p>{row.content?.slice(0, 200)}</p>
                  <p className="text-small wrap">{row.url}</p>
                </article>
              ))}
            </div>
            <label className="csv-consent">
              <input
                type="checkbox"
                required
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={busy}
              />
              <span>
                {t(
                  "These records may be shared with signed-in users. I have permission to upload them and have removed private or sensitive data.",
                )}
              </span>
            </label>
          </>
        )}
        <Button disabled={busy || !csv || !confirmed}>
          {t(busy ? "Importing…" : "Import signals")}
        </Button>
        {error && (
          <p role="alert" className="error-message">
            {t(error)}
          </p>
        )}
        {result && (
          <p role="status" className="success-message">
            {t("Imported")}: {result.inserted} · {t("Duplicates")}:{" "}
            {result.duplicates}.{" "}
            {t("Start processing to analyze the imported signals.")}
          </p>
        )}
      </form>
    </section>
  );
}
