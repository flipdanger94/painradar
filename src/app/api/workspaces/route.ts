import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  endpoint,
  requireUser,
  input,
  rateLimit,
  ApiError,
} from "@/lib/security";
import { requireTeam, availableWorkspaces } from "@/lib/tenancy";
export const GET = endpoint(async () => {
  const u = await requireUser();
  return Response.json(await availableWorkspaces(u.id));
});
export const POST = endpoint(async (req) => {
  const u = await requireUser();
  await rateLimit(u.id);
  const d = await input(
    req,
    z.object({
      teamId: z.uuid(),
      name: z.string().trim().min(2).max(80),
      clientName: z.string().trim().min(2).max(100),
      brandName: z.string().trim().min(2).max(100),
      brandColor: z.string().regex(/^#[a-fA-F0-9]{6}$/),
    }),
  );
  await requireTeam(d.teamId, u.id, true);
  const id = crypto.randomUUID();
  const r = await db().execute(
    sql`select create_client_workspace(${id}::uuid,${d.teamId}::uuid,${u.id},${d.name},${d.clientName},${d.brandName},${d.brandColor}) as id`,
  );
  if (!r.rows[0]?.id)
    throw new ApiError(
      403,
      "Workspace creation is not permitted, or the 100 workspace limit is reached.",
    );
  return Response.json({ id }, { status: 201 });
});
