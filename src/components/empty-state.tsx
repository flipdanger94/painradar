import { ScanLine } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";
export function EmptyState({
  title = "Not enough evidence yet.",
  description = "Real opportunities will appear here after enough independent signals have been collected.",
  action,
}: {
  title?: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="empty-state">
      <ScanLine size={36} />
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <Button asChild variant="outline">
          <Link href={action.href}>{action.label} →</Link>
        </Button>
      )}
    </div>
  );
}
