"use client";
import { useState, useRef } from "react";
import { useTranslation } from "./language-provider";
type Account = {
  email: string;
  plan: string | null;
  active: boolean;
  expires_at: string | null;
  stripe_plan: string | null;
  stripe_status: string | null;
  history: {
    action: string;
    plan: string;
    expires_at: string | null;
    reason: string;
    created_at: string;
    actor: string | null;
  }[];
};
export function SubscriptionGrantForm() {
  const t = useTranslation();
  const request = useRef<{ payload: string; id: string } | null>(null);
  const [email, setEmail] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [action, setAction] = useState("grant");
  const [plan, setPlan] = useState("pro");
  const [duration, setDuration] = useState("30");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const date = (value: string | null) =>
    value ? new Date(value).toLocaleString() : t("Lifetime");
  async function lookup() {
    const response = await fetch(
      "/api/admin/subscriptions?email=" + encodeURIComponent(email.trim()),
      { cache: "no-store" },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error || "The request could not be completed. Please try again.",
      );
    setAccount(data);
  }
  return (
    <section className="panel detail-block" id="manual-subscriptions">
      <h2>{t("Manual subscriptions")}</h2>
      <p>
        {t(
          "Grant access without charging the user. Stripe billing stays separate; the higher active plan applies.",
        )}
      </p>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          setAccount(null);
          try {
            await lookup();
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "The request could not be completed. Please try again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {t("User email")}
          <input
            type="email"
            disabled={busy}
            required
            maxLength={254}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setAccount(null);
              setMessage("");
            }}
          />
        </label>
        <button className="button button-outline" disabled={busy}>
          {t("Find user")}
        </button>
      </form>
      {account && (
        <>
          <p className="wrap">
            <strong>{account.email}</strong>
          </p>
          <p>
            {t("Manual access")}:{" "}
            {account.active
              ? account.plan + " · " + date(account.expires_at)
              : t("No active manual subscription.")}
          </p>
          <p>
            Stripe: {account.stripe_plan || "Free"} ·{" "}
            {t(account.stripe_status || "inactive")}
          </p>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                const payload = JSON.stringify({
                  email: account.email,
                  action,
                  plan,
                  duration,
                  reason,
                });
                if (request.current?.payload !== payload)
                  request.current = { payload, id: crypto.randomUUID() };
                const response = await fetch("/api/admin/subscriptions", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...JSON.parse(payload),
                    requestId: request.current.id,
                  }),
                });
                const data = await response.json();
                if (!response.ok)
                  throw new Error(
                    data.error ||
                      "The request could not be completed. Please try again.",
                  );
                await lookup();
                request.current = null;
                setAction("grant");
                setReason("");
                setMessage("Subscription updated.");
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "The request could not be completed. Please try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {t("Action")}
              <select
                aria-label={t("Action")}
                value={action}
                onChange={(e) => setAction(e.target.value)}
                disabled={busy}
              >
                <option value="grant">{t("Grant or replace access")}</option>
                <option
                  value="extend"
                  disabled={!account.active || !account.expires_at}
                >
                  {t("Extend access")}
                </option>
                <option value="revoke" disabled={!account.active}>
                  {t("Revoke manual access")}
                </option>
              </select>
            </label>
            {action === "grant" && (
              <label>
                {t("Plan")}
                <select
                  aria-label={t("Plan")}
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  disabled={busy}
                >
                  <option value="pro">Pro</option>
                  <option value="founder">Founder</option>
                  <option value="agency">Agency</option>
                </select>
              </label>
            )}
            {action !== "revoke" && (
              <label>
                {t("Duration")}
                <select
                  aria-label={t("Duration")}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  disabled={busy}
                >
                  {["30", "90", "365"].map((d) => (
                    <option value={d} key={d}>
                      {d} {t("days")}
                    </option>
                  ))}
                  <option value="forever">{t("Lifetime")}</option>
                </select>
              </label>
            )}
            <label>
              {t("Reason")}
              <textarea
                required
                minLength={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
              />
            </label>
            <p className="text-small">
              {t(
                action === "extend"
                  ? "Days are added to the current expiration date."
                  : action === "revoke"
                    ? "Only manual access will be revoked. Stripe payments will continue."
                    : "This replaces existing manual access. The term starts now.",
              )}
            </p>
            <button
              className="button button-primary"
              disabled={busy || (action !== "grant" && !account.active)}
            >
              {t(
                busy
                  ? "Saving…"
                  : action === "revoke"
                    ? "Revoke manual access"
                    : action === "extend"
                      ? "Extend access"
                      : "Grant access",
              )}
            </button>
          </form>
          <h3>{t("Access history")}</h3>
          {account.history.length === 0 && <p>{t("No access changes yet.")}</p>}
          {account.history.map((h, i) => (
            <div className="report-row" key={i}>
              <div className="wrap">
                <strong>
                  {t(
                    h.action.split(".").at(-1) === "grant"
                      ? "Grant access"
                      : h.action.endsWith("extend")
                        ? "Extend access"
                        : "Revoke manual access",
                  )}
                </strong>{" "}
                · {h.plan}
                <p>
                  {date(h.created_at)} · {h.actor || "—"}
                </p>
                <p>
                  {t("Access until")}: {date(h.expires_at)}
                </p>
                <p>{h.reason}</p>
              </div>
            </div>
          ))}
        </>
      )}
      {message && <p role="status">{t(message)}</p>}
    </section>
  );
}
