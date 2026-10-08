"use client";
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
      <div className="eyebrow">YOUR INTELLIGENCE WORKSPACE</div>
      <h1>{title}</h1>
      <p>
        {mode === "signup"
          ? "Create your free PainRadar account."
          : "Evidence first. Your next opportunity awaits."}
      </p>
      <form className="form-stack" onSubmit={submit}>
        {mode === "signup" && (
          <div>
            <label htmlFor="name">Name</label>
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
            <label htmlFor="email">Email</label>
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
            <label htmlFor="password">Password</label>
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
            Forgot password?
          </Link>
        )}
        {error && (
          <div role="alert" className="error-message">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="success-message">
            {message}
          </div>
        )}
        <Button disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "signup"
              ? "Create free account"
              : mode === "login"
                ? "Log in"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Reset password"}
        </Button>
      </form>
      {(mode === "login" || mode === "signup") && (google || github) && (
        <>
          <div className="divider">OR CONTINUE WITH</div>
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
            Already have an account? <Link href="/login">Log in</Link>
          </>
        ) : (
          <>
            New to PainRadar? <Link href="/signup">Start free</Link>
          </>
        )}
      </div>
      <div className="form-footer">
        <Link href="/verify-email">Resend verification email</Link>
      </div>
      <p className="auth-fineprint">
        By continuing, you agree to our <Link href="/terms">Terms</Link> and{" "}
        <Link href="/privacy">Privacy notice</Link>.
      </p>
    </div>
  );
}
