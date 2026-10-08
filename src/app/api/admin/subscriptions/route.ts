import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  endpoint,
  requireAdmin,
  rateLimit,
  input,
  ApiError,
} from "@/lib/security";
import { grantAccount, grantInput } from "@/lib/subscription-grants";
export const GET = endpoint(async (req) => {
  const admin = await requireAdmin();
  await rateLimit(admin.id);
  const parsed = z
    .email()
    .safeParse(new URL(req.url).searchParams.get("email")?.trim());
  if (!parsed.success) throw new ApiError(400, "Enter a valid email.");
  const account = await grantAccount(parsed.data);
  if (!account) throw new ApiError(404, "User not found.");
  return Response.json(account, { headers: { "Cache-Control": "no-store" } });
});
export const POST = endpoint(async (req) => {
  const admin = await requireAdmin();
  await rateLimit(admin.id);
  const d = await input(req, grantInput);
  const result = await db().execute(
    sql`select manage_subscription_grant(${admin.id},${d.email},${d.action},${d.plan},${d.duration === "forever" ? null : Number(d.duration)},${d.reason},${d.requestId}::uuid) as outcome`,
  );
  const outcome = result.rows[0].outcome as { error?: string; status?: number };
  if (outcome.error) throw new ApiError(outcome.status || 400, outcome.error);
  return Response.json({ ok: true });
});
