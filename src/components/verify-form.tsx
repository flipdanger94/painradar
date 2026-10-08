"use client";
import { Text } from "@/components/language-provider";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";
export function VerifyForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        setOk(false);
        try {
          const r = await authClient.sendVerificationEmail({
            email: String(f.get("email")),
            callbackURL: "/app",
          });
          if (r.error)
            throw new Error(r.error.message || "Unable to send email");
          setOk(true);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unable to send email");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label htmlFor="verify-email">
          <Text value={"Email"} />
        </label>
        <input
          id="verify-email"
          name="email"
          required
          type="email"
          maxLength={254}
          autoComplete="email"
        />
      </div>
      <Button disabled={busy}>
        {busy ? "Sending…" : "Send verification link"}
      </Button>
      {ok && (
        <p className="success-message" role="status">
          If your account needs verification, a link will be sent.
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
