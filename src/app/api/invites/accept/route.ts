import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { hash } from "@/lib/ai";
import {
  endpoint,
  requireUser,
  input,
  rateLimit,
  ApiError,
} from "@/lib/security";
export const POST = endpoint(async (req) => {
  const u = await requireUser();
  await rateLimit(u.id);
  const { token } = await input(
    req,
    z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }),
  );
  const r = await db().execute(
    sql`select accept_team_invite(${hash(token)},${u.id}) as team_id`,
  );
  if (!r.rows[0]?.team_id)
    throw new ApiError(
      403,
      "Invitation expired, already used, revoked, or addressed to a different verified email.",
    );
  return Response.json({ teamId: r.rows[0].team_id });
});
