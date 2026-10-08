"use client";
import { Text, useTranslation } from "@/components/language-provider";

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
export type RadarValues = {
  id: string;
  name: string;
  keywords: string[];
  excludedWords: string[];
  industries: string[];
  sources: string[];
  languages: string[];
  alertThreshold: number;
  frequency: string;
};
export function RadarForm({
  workspaceId,
  radar,
}: {
  workspaceId?: string;
  radar?: RadarValues;
}) {
  const t = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  return (
    <form
      className="form-stack"
      aria-busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        setBusy(true);
        setError("");
        setSuccess(false);
        try {
          const r = await fetch("/api/radars", {
            method: radar ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceId,
              id: radar?.id,
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
          const d = await r.json().catch(() => null);
          if (!r.ok || !d?.id)
            throw new Error(
              d?.error || "Could not save radar. Please try again.",
            );
          if (!radar) {
            track("radar_created", { radarId: d.id });
            form.reset();
          }
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
        <label htmlFor={`${radar?.id || workspaceId || "new"}-name`}>
          <Text value={"Radar name"} />
        </label>
        <input
          id={`${radar?.id || workspaceId || "new"}-name`}
          name="name"
          defaultValue={radar?.name}
          placeholder="e.g. Developer workflow friction"
          required
          minLength={2}
          maxLength={80}
        />
      </div>
      <div>
        <label htmlFor={`${radar?.id || workspaceId || "new"}-keywords`}>
          <Text value={"Keywords, separated by commas"} />
        </label>
        <input
          id={`${radar?.id || workspaceId || "new"}-keywords`}
          name="keywords"
          defaultValue={radar?.keywords.join(", ")}
          placeholder="deployment, debugging, slow builds"
          required
          maxLength={1600}
        />
      </div>
      <div>
        <label htmlFor={`${radar?.id || workspaceId || "new"}-excluded`}>
          <Text value={"Excluded words"} />
        </label>
        <input
          id={`${radar?.id || workspaceId || "new"}-excluded`}
          name="excludedWords"
          defaultValue={radar?.excludedWords.join(", ")}
          placeholder="job posting, hiring"
          maxLength={1600}
        />
      </div>
      <div>
        <label htmlFor={`${radar?.id || workspaceId || "new"}-industries`}>
          <Text value={"Industries (optional)"} />
        </label>
        <input
          id={`${radar?.id || workspaceId || "new"}-industries`}
          name="industries"
          defaultValue={radar?.industries.join(", ")}
          placeholder="Developer tools"
          maxLength={1600}
          list={`${radar?.id || workspaceId || "new"}-industry-options`}
        />
        <datalist id={`${radar?.id || workspaceId || "new"}-industry-options`}>
          {industries.map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
      </div>
      <fieldset>
        <legend className="text-small muted">
          <Text value={"Sources"} />
        </legend>
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
              defaultChecked={radar ? radar.sources.includes(id) : id === "hn"}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend className="text-small muted">{t("Languages")}</legend>
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
              defaultChecked={
                radar ? radar.languages.includes(id) : id === "en"
              }
            />
            {t(languageLabels[id])}
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor={`${radar?.id || workspaceId || "new"}-threshold`}>
          <Text value={"Alert score threshold"} />
        </label>
        <input
          id={`${radar?.id || workspaceId || "new"}-threshold`}
          name="threshold"
          type="number"
          min={0}
          max={100}
          defaultValue={radar?.alertThreshold ?? 60}
          required
        />
      </div>
      <div>
        <label htmlFor={`${radar?.id || workspaceId || "new"}-frequency`}>
          <Text value={"Frequency"} />
        </label>
        <select
          id={`${radar?.id || workspaceId || "new"}-frequency`}
          name="frequency"
          defaultValue={radar?.frequency ?? "daily"}
        >
          <option value="daily">
            <Text value={"Daily"} />
          </option>
          <option value="weekly">
            <Text value={"Weekly"} />
          </option>
        </select>
      </div>
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
      {success && (
        <p className="success-message" role="status">
          {t(
            radar
              ? "Radar updated. Alerts will use the saved filters."
              : "Radar created. Alerts will follow matching evidence.",
          )}
        </p>
      )}
      <Button disabled={busy}>
        {t(busy ? "Saving…" : radar ? "Save changes" : "Create radar →")}
      </Button>
    </form>
  );
}
