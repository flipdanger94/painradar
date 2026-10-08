import { industryMatches } from "./taxonomy";
import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { workspaceAudience } from "./tenancy";
import { userPlan } from "./security";
import { sendEmail } from "./email";
export function matchesRadar(
  o: { title: string; summary: string; industry: string },
  r: { keywords: string[]; excludedWords: string[]; industries: string[] },
) {
  const text = (o.title + " " + o.summary + " " + o.industry).toLowerCase();
  return (
    r.keywords.some((k) => text.includes(k.toLowerCase())) &&
    !r.excludedWords.some((k) => text.includes(k.toLowerCase())) &&
    (!r.industries.length ||
      r.industries.some((k) => industryMatches(o.industry, k)))
  );
}
export async function sendAlertEmails() {
  if (!process.env.RESEND_API_KEY) return;
  const pending = await db()
    .select({
      notification: notifications,
      email: users.email,
    })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.userId))
    .where(
      and(
        isNull(notifications.emailedAt),
        sql`${notifications.createdAt}>now()-interval '7 days'`,
        sql`((${notifications.workspaceId} is not null and workspace_role(${notifications.workspaceId},${notifications.userId}) is not null) or (${notifications.workspaceId} is null and exists(select 1 from subscriptions sub where sub.user_id=${notifications.userId} and sub.plan in ('pro','founder','agency') and sub.status in ('active','trialing') and (sub.current_period_end is null or sub.current_period_end>now()))))`,
      ),
    )
    .orderBy(notifications.createdAt, notifications.id)
    .limit(10);
  for (const row of pending) {
    if (row.notification.workspaceId) {
      if (
        !(await workspaceAudience(row.notification.workspaceId)).some(
          (u) => u.id === row.notification.userId,
        )
      )
        continue;
    } else if ((await userPlan(row.notification.userId)) === "free") continue;
    await sendEmail(
      row.email,
      "PainRadar: " + row.notification.title,
      row.notification.body +
        "\n" +
        process.env.NEXT_PUBLIC_APP_URL +
        "/app/opportunities/" +
        row.notification.opportunityId +
        (row.notification.workspaceId
          ? "?workspace=" + row.notification.workspaceId
          : ""),
      "alert-" + row.notification.id,
    );
    await db()
      .update(notifications)
      .set({ emailedAt: new Date() })
      .where(eq(notifications.id, row.notification.id));
  }
}
