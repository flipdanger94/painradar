import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { notifications } from "@/db/schema";

export const notificationReadSchema = z.union([
  z.object({ id: z.uuid() }).strict(),
  z.object({ ids: z.array(z.uuid()).min(1).max(100) }).strict(),
]);
export function notificationAccess(userId: string) {
  return and(
    eq(notifications.userId, userId),
    sql`(${notifications.workspaceId} is null or workspace_role(${notifications.workspaceId},${userId}) is not null)`,
  );
}
export function unreadNotifications(userId: string) {
  return and(notificationAccess(userId), isNull(notifications.readAt));
}
const cursorSchema = z
  .object({ id: z.uuid(), createdAt: z.iso.datetime() })
  .strict();
export function notificationCursor(row: {
  id: string;
  createdAt: Date | string;
}) {
  return Buffer.from(
    JSON.stringify({
      id: row.id,
      createdAt:
        typeof row.createdAt === "string"
          ? row.createdAt
          : row.createdAt.toISOString(),
    }),
  ).toString("base64url");
}
export function parseNotificationCursor(value: string | string[] | undefined) {
  if (typeof value !== "string" || value.length > 300) return null;
  try {
    const parsed = cursorSchema.safeParse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    return parsed.success
      ? { id: parsed.data.id, createdAt: parsed.data.createdAt }
      : null;
  } catch {
    return null;
  }
}
