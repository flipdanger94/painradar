"use client";
import { languageCodes, languageLabels } from "@/lib/language-options";
import { industries } from "@/lib/taxonomy";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { track } from "./analytics";
const split = (s: FormDataEntryValue | null) =>
  String(s || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
export function RadarForm({ workspaceId }: { workspaceId?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        setBusy(true);
        setError("");
        setSuccess(false);
        try {
          const r = await fetch("/api/radars", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceId,
              name: f.get("name"),
              keywords: split(f.get("keywords")),
              excludedWords: split(f.get("excludedWords")),
              industries: split(f.get("industries")),
              sources: f.getAll("sources"),
              languages: f.getAll("languages"),
              alertThreshold: Number(f.get("threshold")),
              frequency: f.get("frequency"),
            }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          track("radar_created", { radarId: d.id });
          form.reset();
          setSuccess(true);
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not create radar");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label htmlFor="radar-name">Radar name</label>
        <input
          id="radar-name"
          name="name"
          placeholder="e.g. Developer workflow friction"
          required
          minLength={2}
          maxLength={80}
        />
      </div>
      <div>
        <label htmlFor="radar-keywords">Keywords, separated by commas</label>
        <input
          id="radar-keywords"
          name="keywords"
          placeholder="deployment, debugging, slow builds"
          required
          maxLength={1600}
        />
      </div>
      <div>
        <label htmlFor="radar-excluded">Excluded words</label>
        <input
          id="radar-excluded"
          name="excludedWords"
          placeholder="job posting, hiring"
          maxLength={1600}
        />
      </div>
      <div>
        <label htmlFor="radar-industries">Industries (optional)</label>
        <input
          id="radar-industries"
          name="industries"
          placeholder="Developer tools"
          maxLength={1600}
          list="radar-industry-options"
        />
        <datalist id="radar-industry-options">
          {industries.map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
      </div>
      <fieldset>
        <legend className="text-small muted">Sources</legend>
        {[
          ["hn", "Hacker News"],
          ["github", "GitHub Issues"],
          ["reddit", "Reddit"],
        ].map(([id, label]) => (
          <label
            key={id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginRight: 15,
            }}
          >
            <input
              style={{ width: "auto" }}
              type="checkbox"
              name="sources"
              value={id}
              defaultChecked={id === "hn"}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend className="text-small muted">Languages</legend>
        {languageCodes.map((id) => (
          <label
            key={id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginRight: 15,
            }}
          >
            <input
              style={{ width: "auto" }}
              type="checkbox"
              name="languages"
              value={id}
              defaultChecked={id === "en"}
            />
            {languageLabels[id]}
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor="radar-threshold">Alert score threshold</label>
        <input
          id="radar-threshold"
          name="threshold"
          type="number"
          min={0}
          max={100}
          defaultValue={60}
          required
        />
      </div>
      <div>
        <label htmlFor="radar-frequency">Frequency</label>
        <select id="radar-frequency" name="frequency">
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {success && (
        <p className="success-message" role="status">
          Radar created. Alerts will follow matching evidence.
        </p>
      )}
      <Button disabled={busy}>{busy ? "Creating…" : "Create radar →"}</Button>
    </form>
  );
}
