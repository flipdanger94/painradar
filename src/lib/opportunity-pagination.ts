import { and, or, eq, lt, gt } from "drizzle-orm";
import { opportunities } from "@/db/schema";
import type { PageCursor } from "./api-pagination";
export function opportunityPageBoundary(cursor: PageCursor) {
  return or(
    lt(opportunities.score, cursor.score),
    and(eq(opportunities.score, cursor.score), gt(opportunities.id, cursor.id)),
  );
}
