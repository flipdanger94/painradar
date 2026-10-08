"use client";
import { useTranslation } from "./language-provider";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Bookmark, Check } from "lucide-react";
import { track } from "./analytics";
export function ApiButton({
  endpoint,
  payload,
  label,
  method = "POST",
  refresh = true,
}: {
  endpoint: string;
  payload?: unknown;
  label: string;
  method?: string;
  refresh?: boolean;
}) {
  const t = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch(endpoint, {
              method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload || {}),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            setOk(true);
            if (refresh) router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Request failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        {t(
          busy
            ? "Working…"
            : ok
              ? endpoint === "/api/admin/collect"
                ? "Request sent"
                : "Completed"
              : label,
        )}
      </Button>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
    </>
  );
}
export function SaveButton({
  id,
  saved = false,
  workspaceId,
}: {
  id: string;
  saved?: boolean;
  workspaceId?: string;
}) {
  const t = useTranslation();
  const [active, setActive] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/watchlist", {
              method: active ? "DELETE" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, workspaceId }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            if (!active) track("opportunity_saved", { opportunityId: id });
            setActive(!active);
            router.refresh();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to save");
          } finally {
            setBusy(false);
          }
        }}
      >
        {active ? <Check size={14} /> : <Bookmark size={14} />}{" "}
        {t(active ? "Saved" : "Save opportunity")}
      </Button>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function MvpButton({
  id,
  workspaceId,
}: {
  id: string;
  workspaceId?: string;
}) {
  return (
    <ApiButton
      endpoint="/api/mvp"
      payload={{ id, workspaceId }}
      label="Generate MVP hypothesis ↗"
    />
  );
}
export function EvidenceLink({ url, id }: { url: string; id: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("evidence_opened", { signalId: id })}
    >
      Read original conversation ↗
    </a>
  );
}
