import { z } from "zod";
import { sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { hash } from "@/lib/ai";
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
        email: z
          .email()
          .max(254)
          .transform((s) => s.toLowerCase()),
        role: z.enum(["admin", "member"]),
      }),
    );
    const token = randomBytes(32).toString("hex");
    const inviteId = crypto.randomUUID();
    const r = await db().execute(
      sql`select create_team_invite(${inviteId}::uuid,${id}::uuid,${u.id},${d.email},${d.role},${hash(token)}) as id`,
    );
    if (!r.rows[0]?.id)
      throw new ApiError(
        403,
        "You cannot create this invitation, or the team member limit is reached.",
      );
    return Response.json(
      {
        id: inviteId,
        url: process.env.NEXT_PUBLIC_APP_URL + "/app/invites/" + token,
      },
      { status: 201 },
    );
  })(req);
}
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async (req) => {
    const { id } = await params;
    const u = await requireUser();
    await rateLimit(u.id);
    const team = await requireTeam(id, u.id, true);
    const d = await input(req, z.object({ inviteId: z.uuid() }));
    await db().execute(
      sql`update team_invites set revoked_at=now() where id=${d.inviteId}::uuid and team_id=${id}::uuid and accepted_at is null and (created_by=${u.id} or ${team.role}='owner') and team_role(team_id,${u.id}) in ('owner','admin')`,
    );
    return Response.json({ ok: true });
  })(req);
}
