import { sql } from "drizzle-orm";
import { z } from "zod";
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
  const d = await input(
    req,
    z.object({
      id: z.enum(["hn", "github", "reddit"]),
      enabled: z.boolean(),
      config: z.object({
        since: z.iso
          .datetime()
          .refine(
            (s) => new Date(s).getTime() <= Date.now(),
            "Backfill date cannot be in the future",
          )
          .optional(),
        pageBudget: z.number().int().min(1).max(10).default(3),
        keywords: z.array(z.string().min(2).max(80)).max(10).optional(),
        repositories: z
          .array(z.string().regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/))
          .max(20)
          .optional(),
        subreddits: z
          .array(z.string().regex(/^[a-zA-Z0-9_]{2,30}$/))
          .max(10)
          .optional(),
      }),
    }),
  );
  await db()
    .insert(sources)
    .values({
      id: d.id,
      name: { hn: "Hacker News", github: "GitHub Issues", reddit: "Reddit" }[
        d.id
      ],
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
