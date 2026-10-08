"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function ApiKeyForm({ workspaceId }: { workspaceId?: string }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        setKey("");
        try {
          const r = await fetch("/api/keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: f.get("name"), workspaceId }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          setKey(d.key);
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unable to create key");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="key-name">Key name</label>
      <input
        id="key-name"
        name="name"
        required
        maxLength={80}
        placeholder="My research integration"
      />
      <Button disabled={busy}>{busy ? "Creating…" : "Create API key"}</Button>
      {key && (
        <div className="notice wrap">
          Copy this key now. It will never be shown again.
          <br />
          <code>{key}</code>
        </div>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
