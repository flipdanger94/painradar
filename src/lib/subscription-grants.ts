import { z } from "zod";
import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptionGrants } from "@/db/schema";
export const grantInput = z
  .object({
    requestId: z.uuid(),
    email: z.string().trim().toLowerCase().pipe(z.email()),
    action: z.enum(["grant", "extend", "revoke"]),
    plan: z.enum(["pro", "founder", "agency"]),
    duration: z.enum(["30", "90", "365", "forever"]),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
export async function manualGrant(userId: string) {
  const [row] = await db()
    .select()
    .from(subscriptionGrants)
    .where(eq(subscriptionGrants.userId, userId));
  return row &&
    !row.revokedAt &&
    (!row.expiresAt || row.expiresAt.getTime() > Date.now())
    ? row
    : null;
}
export async function grantAccount(email: string) {
  const result = await db().execute(sql`select u.email,u.id,
    g.plan,g.expires_at::text,g.revoked_at::text,
    (g.user_id is not null and g.revoked_at is null and (g.expires_at is null or g.expires_at>now())) as active,
    s.plan as stripe_plan,s.status as stripe_status,
    coalesce((select jsonb_agg(h) from (select a.action,a.metadata->>'plan' as plan,a.metadata->>'expiresAt' as expires_at,a.metadata->>'reason' as reason,a.created_at,actor.email as actor from audit_logs a left join users actor on actor.id=a.user_id where a.action like 'subscription.manual.%' and a.metadata->>'targetUserId'=u.id order by a.created_at desc,a.id desc limit 10) h),'[]'::jsonb) as history
    from users u left join subscription_grants g on g.user_id=u.id left join subscriptions s on s.user_id=u.id where lower(u.email)=lower(${email}) limit 1`);
  return result.rows[0] ?? null;
}
