"use client";
import { Text } from "@/components/language-provider";

import { Button } from "@/components/ui/button";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <div className="empty-state">
      <h2>
        <Text value={"Something went wrong"} />
      </h2>
      <p>Please try again. If this continues, contact the administrator.</p>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}
