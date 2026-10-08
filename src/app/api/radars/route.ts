import { languageCodes } from "@/lib/language-options";
import { z } from "zod";
import { eq, sql, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { radars } from "@/db/schema";
import {
  endpoint,
  requireUser,
  rateLimit,
  input,
  userPlan,
  ApiError,
  audit,
} from "@/lib/security";
import { requireWorkspace } from "@/lib/tenancy";
import { plans } from "@/lib/plans";
const radarSchema = z.object({
  workspaceId: z.uuid().optional(),
  name: z.string().trim().min(2).max(80),
  keywords: z.array(z.string().trim().min(2).max(80)).min(1).max(20),
  excludedWords: z.array(z.string().trim().max(80)).max(20).default([]),
  industries: z.array(z.string().max(80)).max(20).default([]),
  sources: z.array(z.enum(["hn", "github", "reddit"])).min(1),
  languages: z.array(z.enum(languageCodes)).min(1),
  alertThreshold: z.number().int().min(0).max(100),
  frequency: z.enum(["daily", "weekly"]),
});
export const GET = endpoint(async (req) => {
  const user = await requireUser();
  const ws = new URL(req.url).searchParams.get("workspaceId");
  if (ws) {
    await requireWorkspace(ws, user.id);
    return Response.json(
      await db().select().from(radars).where(eq(radars.workspaceId, ws)),
    );
  }
  return Response.json(
    await db()
      .select()
      .from(radars)
      .where(and(eq(radars.userId, user.id), isNull(radars.workspaceId))),
  );
});
export const POST = endpoint(async (req) => {
  const user = await requireUser();
  await rateLimit(user.id);
  const data = await input(req, radarSchema);
  if (data.workspaceId) {
    await requireWorkspace(data.workspaceId, user.id, "edit");
    const id = crypto.randomUUID();
    const result = await db().execute(
      sql`select create_workspace_radar_limited(${id}::uuid,${data.workspaceId}::uuid,${user.id},${data.name},${JSON.stringify(data.excludedWords)}::jsonb,${JSON.stringify(data.industries)}::jsonb,${JSON.stringify(data.sources)}::jsonb,${JSON.stringify(data.languages)}::jsonb,${data.alertThreshold},${data.frequency},${JSON.stringify([...new Set(data.keywords)])}::jsonb) as radar_id`,
    );
    if (!result.rows[0]?.radar_id)
      throw new ApiError(
        403,
        "Workspace radar limit reached or access withdrawn.",
      );
    await audit(user.id, "radar.created", {
      radarId: id,
      workspaceId: data.workspaceId,
    });
    return Response.json({ id }, { status: 201 });
  }
  const plan = await userPlan(user.id);
  const id = crypto.randomUUID();
  const result = await db().execute(
    sql`select create_radar_limited(${id}::uuid,${user.id},${data.name},${JSON.stringify(data.excludedWords)}::jsonb,${JSON.stringify(data.industries)}::jsonb,${JSON.stringify(data.sources)}::jsonb,${JSON.stringify(data.languages)}::jsonb,${data.alertThreshold},${data.frequency},${JSON.stringify([...new Set(data.keywords)])}::jsonb,${plans[plan].radars}) as radar_id`,
  );
  if (!result.rows[0]?.radar_id)
    throw new ApiError(
      403,
      "Your radar limit is reached. Upgrade to add more.",
    );
  await audit(user.id, "radar.created", { radarId: id });
  return Response.json({ id }, { status: 201 });
});
export const DELETE = endpoint(async (req) => {
  const user = await requireUser();
  await rateLimit(user.id);
  const { id } = await input(req, z.object({ id: z.uuid() }));
  const row = (
    await db()
      .select({ workspaceId: radars.workspaceId })
      .from(radars)
      .where(eq(radars.id, id))
  )[0];
  if (row?.workspaceId) {
    await requireWorkspace(row.workspaceId, user.id, "edit");
    await db().execute(
      sql`delete from radars where id=${id}::uuid and workspace_role(workspace_id,${user.id}) in ('admin','editor')`,
    );
  } else
    await db().execute(
      sql`delete from radars where id=${id}::uuid and user_id=${user.id} and workspace_id is null`,
    );
  await audit(user.id, "radar.deleted", { radarId: id });
  return Response.json({ ok: true });
});
