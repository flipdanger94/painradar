"use client";
import { billingRedirectUrl } from "@/lib/billing-redirect";
import { track } from "./analytics";
import { useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
export function BillingButton({
  plan,
  portal = false,
}: {
  plan?: string;
  portal?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (plan === "free")
    return (
      <Button asChild variant="outline">
        <Link href="/signup">Start free →</Link>
      </Button>
    );
  return (
    <>
      <Button
        disabled={busy}
        onClick={async () => {
          if (!portal) track("upgrade_clicked", { plan });
          setBusy(true);
          setError("");
          try {
            const r = await fetch(
              "/api/billing/" + (portal ? "portal" : "checkout"),
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan }),
              },
            );
            const d: unknown = await r.json().catch(() => null);
            const data =
              d && typeof d === "object" ? (d as Record<string, unknown>) : {};
            if (!r.ok)
              throw new Error(
                typeof data.error === "string"
                  ? data.error
                  : "Unable to open billing. Please try again.",
              );
            const url = billingRedirectUrl(data.url);
            if (!url)
              throw new Error(
                "Billing returned an invalid address. Please try again.",
              );
            window.location.assign(url);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to open billing");
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Opening…"
          : portal
            ? "Manage subscription"
            : "Choose " + plan + " ↗"}
      </Button>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
