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
import { requireAgency, availableTeams } from "@/lib/tenancy";
export const GET = endpoint(async () => {
  const u = await requireUser();
  return Response.json(await availableTeams(u.id));
});
export const POST = endpoint(async (req) => {
  const u = await requireUser();
  await rateLimit(u.id);
  await requireAgency(u.id);
  const { name } = await input(
    req,
    z.object({ name: z.string().trim().min(2).max(80) }),
  );
  const id = crypto.randomUUID();
  const r = await db().execute(
    sql`select create_agency_team(${id}::uuid,${u.id},${name}) as id`,
  );
  if (!r.rows[0]?.id)
    throw new ApiError(409, "An agency team already exists for this account.");
  return Response.json({ id }, { status: 201 });
});
