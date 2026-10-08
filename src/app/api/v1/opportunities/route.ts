import {
  apiQuerySchema,
  pageScope,
  decodePageCursor,
  encodePageCursor,
} from "@/lib/api-pagination";
import type { Filters } from "@/lib/queries";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { requireWorkspace } from "@/lib/tenancy";
import { workspaceSaved } from "@/lib/workspace-data";
import { hash } from "@/lib/ai";
import { endpoint, ApiError, rateLimit, userPlan } from "@/lib/security";
import { listOpportunities } from "@/lib/queries";
export const GET = endpoint(async (req) => {
  const key = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!key || !/^pr_[a-f0-9]{64}$/.test(key))
    throw new ApiError(401, "Invalid API key");
  const row = (
    await db()
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.hash, hash(key)), isNull(apiKeys.revokedAt)))
  )[0];
  if (!row) throw new ApiError(401, "Invalid API key");
  await rateLimit("key:" + row.id);
  const parsed = apiQuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success)
    throw new ApiError(
      400,
      "Invalid query: " + parsed.error.issues.map((i) => i.message).join("; "),
    );
  const { cursor, limit, ...filters } = parsed.data;
  const scope = pageScope(row.id, filters);
  const after = cursor ? decodePageCursor(cursor, scope) : undefined;
  let ids: string[] | undefined;
  if (row.workspaceId) {
    await requireWorkspace(row.workspaceId, row.userId);
    ids = (await workspaceSaved(row.workspaceId)).map((r) => r.opportunity.id);
  } else if (!["founder", "agency"].includes(await userPlan(row.userId)))
    throw new ApiError(403, "Active Founder subscription required");
  const query = Object.fromEntries(
    Object.entries(filters).map(([k, v]) => [k, String(v)]),
  ) as Filters;
  const rows = await listOpportunities(
    query,
    limit + 1,
    row.userId,
    ids,
    after,
  );
  const data = rows.slice(0, limit);
  const last = data.at(-1);
  return Response.json(
    {
      ...(row.workspaceId ? { workspaceId: row.workspaceId } : {}),
      data,
      pagination: {
        limit,
        hasMore: rows.length > limit,
        nextCursor:
          rows.length > limit && last
            ? encodePageCursor({ score: last.score, id: last.id }, scope)
            : null,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
