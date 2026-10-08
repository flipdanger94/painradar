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
import { requireWorkspace } from "@/lib/tenancy";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async (req) => {
    const { id } = await params;
    const u = await requireUser();
    await rateLimit(u.id);
    await requireWorkspace(id, u.id, "admin");
    const d = await input(
      req,
      z.object({
        userId: z.string().min(1).max(200),
        role: z.enum(["editor", "viewer", "remove"]),
      }),
    );
    const r = await db().execute(
      sql`select set_workspace_member(${id}::uuid,${u.id},${d.userId},${d.role}) as allowed`,
    );
    if (!r.rows[0]?.allowed)
      throw new ApiError(
        403,
        "Member assignment is not permitted. The user must belong to the same team.",
      );
    return Response.json({ ok: true });
  })(req);
}
