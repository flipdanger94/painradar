"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function SourceConfigForm() {
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const id = String(f.get("source"));
        const values = String(f.get("values"))
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        setBusy(true);
        setError("");
        setOk(false);
        try {
          const r = await fetch("/api/admin/sources", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id,
              enabled: f.get("enabled") === "on",
              config: {
                pageBudget: Number(f.get("pageBudget")),
                ...(f.get("since")
                  ? { since: new Date(String(f.get("since"))).toISOString() }
                  : {}),
                [id === "github"
                  ? "repositories"
                  : id === "reddit"
                    ? "subreddits"
                    : "keywords"]: values,
              },
            }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          setOk(true);
          router.refresh();
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Unable to configure source",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label htmlFor="config-source">Source</label>
        <select id="config-source" name="source">
          <option value="hn">Hacker News</option>
          <option value="github">GitHub Issues</option>
          <option value="reddit">Reddit</option>
        </select>
      </div>
      <div>
        <label htmlFor="config-values">
          Keywords / owner/repository / subreddit names
        </label>
        <textarea
          id="config-values"
          name="values"
          required
          maxLength={1600}
          placeholder="Comma-separated values"
        />
      </div>
      <div>
        <label htmlFor="config-since">Backfill start date (optional)</label>
        <input id="config-since" name="since" type="datetime-local" />
        <p className="text-small">
          Changing configuration restarts collection for the new scopes.
          Existing records are deduplicated.
        </p>
      </div>
      <div>
        <label htmlFor="config-budget">
          Maximum pages per pipeline run (1–10)
        </label>
        <input
          id="config-budget"
          name="pageBudget"
          type="number"
          min={1}
          max={10}
          defaultValue={3}
          required
        />
        <p className="text-small">
          Unfinished collection resumes on the next run. Provider listing limits
          still apply.
        </p>
      </div>
      <label style={{ display: "flex", gap: 10 }}>
        <input
          type="checkbox"
          name="enabled"
          defaultChecked
          style={{ width: "auto" }}
        />{" "}
        Enable collection
      </label>
      <Button disabled={busy}>
        {busy ? "Saving…" : "Save source configuration"}
      </Button>
      {ok && (
        <p className="success-message" role="status">
          Source configured.
        </p>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
