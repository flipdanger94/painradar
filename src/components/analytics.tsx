"use client";
import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { Button } from "./ui/button";
export function track(name: string, properties?: Record<string, unknown>) {
  if (posthog.__loaded && posthog.has_opted_in_capturing())
    posthog.capture(name, properties);
}
export function Analytics() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host:
        process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      opt_out_capturing_by_default: true,
      capture_pageview: false,
      capture_pageleave: false,
      autocapture: false,
      disable_session_recording: true,
    });
    const choice = localStorage.getItem("painradar:analytics");
    if (choice === "yes") posthog.opt_in_capturing();
    else if (choice === null) {
      const frame = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(frame);
    }
  }, []);
  if (!show) return null;
  return (
    <div
      className="notice"
      style={{
        position: "fixed",
        bottom: 15,
        left: 15,
        right: 15,
        zIndex: 50,
        maxWidth: 600,
        margin: "auto",
        background: "#17131d",
      }}
    >
      <p>
        Allow anonymous product analytics? No session recording or automatic
        form capture.
      </p>
      <Button
        size="sm"
        onClick={() => {
          localStorage.setItem("painradar:analytics", "yes");
          posthog.opt_in_capturing();
          setShow(false);
        }}
      >
        Allow
      </Button>{" "}
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          localStorage.setItem("painradar:analytics", "no");
          posthog.opt_out_capturing();
          setShow(false);
        }}
      >
        Decline
      </Button>
    </div>
  );
}
