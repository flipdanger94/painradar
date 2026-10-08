"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <div className="empty-state">
      <h2>Something went wrong</h2>
      <p>Please try again. If this continues, contact the administrator.</p>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}
