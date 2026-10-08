import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { endpoint, requireUser, input, rateLimit } from "@/lib/security";
export const POST = endpoint(async (req) => {
  const u = await requireUser();
  await rateLimit(u.id);
  const { id } = await input(req, z.object({ id: z.uuid() }));
  await db()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.userId, u.id),
        sql`(${notifications.workspaceId} is null or workspace_role(${notifications.workspaceId},${u.id}) is not null)`,
      ),
    );
  return Response.json({ ok: true });
});
