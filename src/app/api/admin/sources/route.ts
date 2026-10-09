import { sql } from "drizzle-orm";
import { sourceConfigInput } from "@/lib/sources/config";
import { sourceNames } from "@/lib/source-catalog";
import { db } from "@/db";
import { sources } from "@/db/schema";
import {
  endpoint,
  requireAdmin,
  input,
  audit,
  rateLimit,
} from "@/lib/security";
export const POST = endpoint(async (req) => {
  const u = await requireAdmin();
  await rateLimit(u.id);
  const d = await input(req, sourceConfigInput);
  await db()
    .insert(sources)
    .values({
      id: d.id,
      name: sourceNames[d.id],
      enabled: d.enabled,
      config: d.config,
    })
    .onConflictDoUpdate({
      target: sources.id,
      set: {
        enabled: d.enabled,
        config: d.config,
        collectionState: sql`case when ${sources.config}=${JSON.stringify(d.config)}::jsonb then ${sources.collectionState} else null end`,
        lastCollectedAt: sql`case when ${sources.config}=${JSON.stringify(d.config)}::jsonb then ${sources.lastCollectedAt} else null end`,
      },
    });
  await audit(u.id, "source.configured", { source: d.id });
  return Response.json({ ok: true });
});
