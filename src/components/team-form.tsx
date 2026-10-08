"use client";
import { useTranslation } from "./language-provider";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
type Field = {
  name: string;
  label: string;
  type?: string;
  value?: string;
  options?: { value: string; label: string }[];
};
export function TeamForm({
  endpoint,
  fields,
  payload = {},
  label,
  method = "POST",
  resultKey,
}: {
  endpoint: string;
  fields: Field[];
  payload?: Record<string, unknown>;
  label: string;
  method?: string;
  resultKey?: string;
}) {
  const t = useTranslation();
  const id = useId();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const values = Object.fromEntries(new FormData(form));
        setBusy(true);
        setError("");
        setResult("");
        try {
          const r = await fetch(endpoint, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, ...values }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "Request failed");
          setResult(resultKey ? String(d[resultKey] || "Saved") : "Saved");
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Request failed");
        } finally {
          setBusy(false);
        }
      }}
    >
      {fields.map((f) => (
        <div key={f.name}>
          <label htmlFor={id + f.name}>{t(f.label)}</label>
          {f.options ? (
            <select id={id + f.name} name={f.name} defaultValue={f.value}>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.label)}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={id + f.name}
              name={f.name}
              type={f.type || "text"}
              defaultValue={f.value}
              required
              maxLength={
                f.name === "brandColor" ? 7 : f.type === "url" ? 2048 : 100
              }
            />
          )}
        </div>
      ))}
      <Button disabled={busy}>{t(busy ? "Saving…" : label)}</Button>
      {error && (
        <p className="error-message" role="alert">
          {t(error)}
        </p>
      )}
      {result && (
        <p className="notice wrap" role="status">
          {resultKey ? t("Copy this value now:") + " " : ""}
          {resultKey ? result : t(result)}
        </p>
      )}
    </form>
  );
}
