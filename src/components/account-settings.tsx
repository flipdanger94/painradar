"use client";
import { Text } from "@/components/language-provider";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";

type AccountSession = {
  id: string;
  current: boolean;
  createdAt: string;
  expiresAt: string;
  userAgent: string | null;
};
export function AccountSettings({
  name,
  email,
  verified,
}: {
  name: string;
  email: string;
  verified: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setSessionError("");
      try {
        const response = await fetch("/api/account/sessions", {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Unable to load sessions.");
        if (active) setSessions(data.sessions);
      } catch (error) {
        if (active)
          setSessionError(
            error instanceof Error ? error.message : "Unable to load sessions.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [reload]);

  async function submit(
    event: React.FormEvent<HTMLFormElement>,
    kind: "profile" | "password",
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (kind === "profile") {
        const name = String(data.get("name") || "").trim();
        if (!name || name.length > 100)
          throw new Error("Enter a name between 1 and 100 characters.");
        const result = await authClient.updateUser({ name });
        if (result.error)
          throw new Error(result.error.message || "Unable to save your name.");
        setMessage("Your name has been updated.");
      } else {
        const newPassword = String(data.get("newPassword") || "");
        if (newPassword !== data.get("confirmPassword"))
          throw new Error("New passwords do not match.");
        const result = await authClient.changePassword({
          currentPassword: String(data.get("currentPassword") || ""),
          newPassword,
          revokeOtherSessions: true,
        });
        if (result.error)
          throw new Error(
            result.error.message || "Unable to change your password.",
          );
        form.reset();
        setReload((value) => value + 1);
        setMessage("Password changed. Other sessions have been signed out.");
      }
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update your account.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setRevoking(id);
    setSessionError("");
    try {
      const response = await fetch("/api/account/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to end this session.");
      setSessions((previous) =>
        previous.filter((session) => session.id !== id),
      );
    } catch (error) {
      setSessionError(
        error instanceof Error ? error.message : "Unable to end this session.",
      );
    } finally {
      setRevoking(null);
    }
  }

  return (
    <section className="panel detail-block account-settings">
      <h2>
        <Text value={"Your account"} />
      </h2>
      <p className="wrap">
        {email} · {verified ? "Email verified" : "Email not verified"}
      </p>
      <div className="settings-grid">
        <form
          className="form-stack"
          onSubmit={(event) => void submit(event, "profile")}
        >
          <div>
            <label htmlFor="account-name">
              <Text value={"Display name"} />
            </label>
            <input
              id="account-name"
              name="name"
              defaultValue={name}
              required
              maxLength={100}
              autoComplete="name"
            />
          </div>
          <Button disabled={busy} type="submit">
            Save name
          </Button>
        </form>
        <form
          className="form-stack"
          onSubmit={(event) => void submit(event, "password")}
        >
          <div>
            <label htmlFor="current-password">
              <Text value={"Current password"} />
            </label>
            <input
              id="current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </div>
          <div>
            <label htmlFor="new-password">
              <Text value={"New password"} />
            </label>
            <input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={128}
            />
          </div>
          <div>
            <label htmlFor="confirm-password">
              <Text value={"Confirm new password"} />
            </label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={128}
            />
          </div>
          <p className="text-small">
            Use at least 10 characters. Changing your password signs out your
            other devices.
          </p>
          <Button disabled={busy} type="submit">
            Change password
          </Button>
        </form>
      </div>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="success-message">
            {message}
          </p>
        )}
      </div>
      <div className="section-rule">
        <h2>
          <Text value={"Active sessions"} />
        </h2>
        <p className="text-small">
          Up to 100 active sessions, newest first. End access on a device you no
          longer use.
        </p>
        {loading && <p role="status">Loading sessions…</p>}
        {sessionError && (
          <div>
            <p role="alert" className="error-message">
              {sessionError}
            </p>
            <Button
              variant="outline"
              onClick={() => setReload((value) => value + 1)}
            >
              Retry
            </Button>
          </div>
        )}
        {!loading && !sessionError && !sessions.length && (
          <p>No active sessions found.</p>
        )}
        {sessions.map((session) => (
          <div className="report-row" key={session.id}>
            <div className="session-description">
              <strong>
                {session.current ? "This device" : "Other device"}
              </strong>
              <p className="text-small wrap">
                {session.userAgent || "Browser details unavailable"}
              </p>
              <p className="text-small">
                Started {new Date(session.createdAt).toLocaleString()}
              </p>
            </div>
            {!session.current && (
              <Button
                variant="outline"
                disabled={revoking !== null || busy}
                onClick={() => void revoke(session.id)}
              >
                {revoking === session.id ? "Ending…" : "End session"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
