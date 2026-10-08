import { sql } from "drizzle-orm";
import { sources } from "@/db/schema";
import type { CollectionState } from "./types";
export function collectionCheckpointGuard(
  config: unknown,
  state: CollectionState | null,
  lastCollectedAt: Date | null,
) {
  return sql`${sources.config}=${JSON.stringify(config)}::jsonb and ${sources.collectionState} is not distinct from ${state ? JSON.stringify(state) : null}::jsonb and ${sources.lastCollectedAt} is not distinct from ${lastCollectedAt?.toISOString() || null}::timestamptz`;
}
