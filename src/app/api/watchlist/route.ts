import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { requireWorkspace } from "@/lib/tenancy";
import { db } from "@/db";
import { watchlists, watchlistItems, opportunities } from "@/db/schema";
import {
  endpoint,
  requireUser,
  rateLimit,
  input,
  ApiError,
  audit,
} from "@/lib/security";
export const POST = endpoint(async (req) => {
  const user = await requireUser();
  await rateLimit(user.id);
  const { id, workspaceId } = await input(
    req,
    z.object({ id: z.uuid(), workspaceId: z.uuid().optional() }),
  );
  if (
    !(
      await db()
        .select({ id: opportunities.id })
        .from(opportunities)
        .where(eq(opportunities.id, id))
    ).length
  )
    throw new ApiError(404, "Opportunity not found");
  if (workspaceId) {
    await requireWorkspace(workspaceId, user.id, "edit");
    const r = await db().execute(
      sql`select mutate_workspace_watchlist(${workspaceId}::uuid,${user.id},${id}::uuid,true) as allowed`,
    );
    if (!r.rows[0]?.allowed)
      throw new ApiError(403, "Workspace access was withdrawn.");
    return Response.json({ ok: true });
  }
  const [list] = await db()
    .insert(watchlists)
    .values({ userId: user.id })
    .onConflictDoUpdate({
      target: watchlists.userId,
      set: { name: "My watchlist" },
    })
    .returning();
  await db()
    .insert(watchlistItems)
    .values({ watchlistId: list.id, opportunityId: id })
    .onConflictDoNothing();
  await audit(user.id, "opportunity.saved", { opportunityId: id });
  return Response.json({ ok: true });
});
export const DELETE = endpoint(async (req) => {
  const user = await requireUser();
  await rateLimit(user.id);
  const { id, workspaceId } = await input(
    req,
    z.object({ id: z.uuid(), workspaceId: z.uuid().optional() }),
  );
  if (workspaceId) {
    await requireWorkspace(workspaceId, user.id, "edit");
    const r = await db().execute(
      sql`select mutate_workspace_watchlist(${workspaceId}::uuid,${user.id},${id}::uuid,false) as allowed`,
    );
    if (!r.rows[0]?.allowed)
      throw new ApiError(403, "Workspace access was withdrawn.");
    return Response.json({ ok: true });
  }
  const [list] = await db()
    .select()
    .from(watchlists)
    .where(eq(watchlists.userId, user.id));
  if (list)
    await db()
      .delete(watchlistItems)
      .where(
        and(
          eq(watchlistItems.watchlistId, list.id),
          eq(watchlistItems.opportunityId, id),
        ),
      );
  return Response.json({ ok: true });
});
