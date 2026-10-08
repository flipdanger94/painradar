"use client";
import { Text, useTranslation } from "@/components/language-provider";

import { track } from "./analytics";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";
export function AuthForm({
  mode,
  google,
  github,
}: {
  mode: "login" | "signup" | "forgot" | "reset";
  google: boolean;
  github: boolean;
}) {
  const t = useTranslation();
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      let result;
      if (mode === "signup")
        result = await authClient.signUp.email({
          name: String(f.get("name")),
          email: String(f.get("email")),
          password: String(f.get("password")),
          callbackURL: "/app",
        });
      else if (mode === "login")
        result = await authClient.signIn.email({
          email: String(f.get("email")),
          password: String(f.get("password")),
          callbackURL: "/app",
        });
      else if (mode === "forgot")
        result = await authClient.requestPasswordReset({
          email: String(f.get("email")),
          redirectTo: "/reset-password",
        });
      else
        result = await authClient.resetPassword({
          newPassword: String(f.get("password")),
          token: new URLSearchParams(window.location.search).get("token") || "",
        });
      if (result.error)
        throw new Error(result.error.message || "Request failed");
      if (mode === "login") {
        track("login");
        router.push("/app");
        router.refresh();
        return;
      }
      if (mode === "signup") track("signup");
      setMessage(
        mode === "signup"
          ? "Check your email to verify your account."
          : mode === "forgot"
            ? "If an account exists, a reset link will be sent."
            : "Your password has been reset. You can now log in.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to complete the request.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function social(provider: "google" | "github") {
    setBusy(true);
    setError("");
    try {
      const r = await authClient.signIn.social({
        provider,
        callbackURL: "/app",
      });
      if (r.error) throw new Error(r.error.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setBusy(false);
    }
  }
  const title = {
    login: "Welcome back.",
    signup: "Start finding real problems.",
    forgot: "Reset your password.",
    reset: "Choose a new password.",
  }[mode];
  return (
    <div className="auth-wrap">
      <div className="eyebrow">{t("YOUR INTELLIGENCE WORKSPACE")}</div>
      <h1>{t(title)}</h1>
      <p>
        {t(
          mode === "signup"
            ? "Create your free PainRadar account."
            : "Evidence first. Your next opportunity awaits.",
        )}
      </p>
      <form className="form-stack" onSubmit={submit}>
        {mode === "signup" && (
          <div>
            <label htmlFor="name">
              <Text value={"Name"} />
            </label>
            <input
              id="name"
              name="name"
              required
              maxLength={100}
              autoComplete="name"
            />
          </div>
        )}
        {mode !== "reset" && (
          <div>
            <label htmlFor="email">
              <Text value={"Email"} />
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
            />
          </div>
        )}
        {mode !== "forgot" && (
          <div>
            <label htmlFor="password">
              <Text value={"Password"} />
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={10}
              maxLength={128}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </div>
        )}
        {mode === "login" && (
          <Link className="text-link" href="/forgot-password">
            <Text value={"Forgot password?"} />
          </Link>
        )}
        {error && (
          <div role="alert" className="error-message">
            {t(error)}
          </div>
        )}
        {message && (
          <div role="status" className="success-message">
            {t(message)}
          </div>
        )}
        <Button disabled={busy}>
          {t(
            busy
              ? "Please wait…"
              : mode === "signup"
                ? "Create free account"
                : mode === "login"
                  ? "Log in"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Reset password",
          )}
        </Button>
      </form>
      {(mode === "login" || mode === "signup") && (google || github) && (
        <>
          <div className="divider">
            <Text value={"OR CONTINUE WITH"} />
          </div>
          <div className="oauth-grid">
            {google && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => social("google")}
              >
                Google
              </Button>
            )}
            {github && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => social("github")}
              >
                GitHub
              </Button>
            )}
          </div>
        </>
      )}
      <div className="form-footer">
        {mode === "signup" ? (
          <>
            <Text value={"Already have an account?"} />{" "}
            <Link href="/login">
              <Text value={"Log in"} />
            </Link>
          </>
        ) : (
          <>
            <Text value={"New to PainRadar?"} />{" "}
            <Link href="/signup">
              <Text value={"Start free"} />
            </Link>
          </>
        )}
      </div>
      <div className="form-footer">
        <Link href="/verify-email">
          <Text value={"Resend verification email"} />
        </Link>
      </div>
      <p className="auth-fineprint">
        <Text value="By continuing, you agree to our" />{" "}
        <Link href="/terms">
          <Text value={"Terms"} />
        </Link>{" "}
        <Text value="and" />{" "}
        <Link href="/privacy">
          <Text value={"Privacy notice"} />
        </Link>
        .
      </p>
    </div>
  );
}
