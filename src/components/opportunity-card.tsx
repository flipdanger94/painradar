import Link from "next/link";
import type { Opportunity } from "@/lib/queries";
export function OpportunityCard({
  o,
  delta,
  workspaceId,
}: {
  o: Opportunity;
  delta?: number | null;
  workspaceId?: string;
}) {
  return (
    <Link
      prefetch={false}
      href={
        "/app/opportunities/" +
        o.id +
        (workspaceId ? "?workspace=" + workspaceId : "")
      }
      className="opportunity-card"
    >
      <div className="card-top">
        <span className="badge">{o.industry}</span>
        <span className="score">
          {o.score}
          <span className="text-small muted"> / 100</span>
        </span>
      </div>
      <h3>{o.title}</h3>
      <p>{o.summary}</p>
      <div className="card-meta">
        <span>{o.mentions} signals</span>
        <span
          className={o.growth7d !== null && o.growth7d < 0 ? "red" : "growth"}
        >
          {o.growth7d === null
            ? "Growth: not enough history"
            : `${o.growth7d > 0 ? "+" : ""}${o.growth7d}% · 7d`}
        </span>
        <span>{o.confidence} confidence</span>
        <span>{o.status}</span>
        {delta !== undefined && delta !== null && (
          <span className={delta < 0 ? "red" : "green"}>
            {delta > 0 ? "+" : ""}
            {delta} since viewed
          </span>
        )}
      </div>
    </Link>
  );
}
