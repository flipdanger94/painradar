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
import { requireTeam } from "@/lib/tenancy";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async (req) => {
    const { id } = await params;
    const u = await requireUser();
    await rateLimit(u.id);
    await requireTeam(id, u.id, true);
    const d = await input(
      req,
      z.object({
        userId: z.string().min(1).max(200),
        action: z.enum(["role", "remove"]),
        role: z.enum(["admin", "member"]).default("member"),
      }),
    );
    const r = await db().execute(
      sql`select manage_team_member(${id}::uuid,${u.id},${d.userId},${d.action},${d.role}) as allowed`,
    );
    if (!r.rows[0]?.allowed)
      throw new ApiError(
        403,
        "This membership change is not permitted. The owner cannot be removed.",
      );
    return Response.json({ ok: true });
  })(req);
}
