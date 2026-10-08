"use client";
import { useEffect, useRef } from "react";
import { track } from "./analytics";
export function TrackEvent({
  event,
  properties,
}: {
  event: string;
  properties: Record<string, unknown>;
}) {
  const sent = useRef(false);
  useEffect(() => {
    if (!sent.current) {
      sent.current = true;
      track(event, properties);
    }
  }, [event, properties]);
  return null;
}
