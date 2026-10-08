import { and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { endpoint, requireUser, input, rateLimit } from "@/lib/security";
import {
  notificationReadSchema,
  unreadNotifications,
} from "@/lib/notification-inbox";
export const POST = endpoint(async (req) => {
  const u = await requireUser();
  await rateLimit(u.id);
  const data = await input(req, notificationReadSchema);
  const ids = "id" in data ? [data.id] : [...new Set(data.ids)];
  const updated = await db()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(inArray(notifications.id, ids), unreadNotifications(u.id)))
    .returning({ id: notifications.id });
  return Response.json({ ok: true, updated: updated.length });
});
