import { z } from "zod";
import { randomBytes } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { requireWorkspace } from "@/lib/tenancy";
import { hash } from "@/lib/ai";
import {
  endpoint,
  requireUser,
  userPlan,
  input,
  ApiError,
  rateLimit,
  audit,
} from "@/lib/security";
export const POST = endpoint(async (req) => {
  const u = await requireUser();
  await rateLimit(u.id);

  const { name, workspaceId } = await input(
    req,
    z.object({
      name: z.string().trim().min(1).max(80),
      workspaceId: z.uuid().optional(),
    }),
  );
  if (workspaceId) await requireWorkspace(workspaceId, u.id, "edit");
  else if (!["founder", "agency"].includes(await userPlan(u.id)))
    throw new ApiError(403, "Founder plan required for personal API keys");
  const key = "pr_" + randomBytes(32).toString("hex");
  if (workspaceId) {
    const r = await db().execute(
      sql`insert into api_keys(user_id,workspace_id,name,hash,prefix) select ${u.id},${workspaceId}::uuid,${name},${hash(key)},${key.slice(0, 11)} where workspace_role(${workspaceId}::uuid,${u.id}) in ('admin','editor') returning id`,
    );
    if (!r.rows.length)
      throw new ApiError(403, "Workspace access was withdrawn.");
  } else
    await db()
      .insert(apiKeys)
      .values({
        userId: u.id,
        name,
        hash: hash(key),
        prefix: key.slice(0, 11),
      });
  await audit(u.id, "api_key.created", { name });
  return Response.json({ key }, { status: 201 });
});
export const DELETE = endpoint(async (req) => {
  const u = await requireUser();
  await rateLimit(u.id);
  const { id } = await input(req, z.object({ id: z.uuid() }));
  const row = (await db().select().from(apiKeys).where(eq(apiKeys.id, id)))[0];
  if (row?.workspaceId) {
    const context = await requireWorkspace(row.workspaceId, u.id, "edit");
    if (row.userId !== u.id && context.role !== "admin")
      throw new ApiError(
        403,
        "Only the key creator or workspace administrator can revoke this key.",
      );
    await db().execute(
      sql`update api_keys set revoked_at=now() where id=${id}::uuid and workspace_role(workspace_id,${u.id}) in ('admin','editor')`,
    );
    await audit(u.id, "api_key.revoked", {
      keyId: id,
      workspaceId: row.workspaceId,
    });
    return Response.json({ ok: true });
  }
  await db()
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, u.id)));
  await audit(u.id, "api_key.revoked", { keyId: id });
  return Response.json({ ok: true });
});
