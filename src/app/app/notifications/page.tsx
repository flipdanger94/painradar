import { Text } from "@/components/language-provider";
import Link from "next/link";
import { desc, and, sql, count, getTableColumns } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { ApiButton } from "@/components/actions";
import { EmptyState } from "@/components/empty-state";
import {
  notificationAccess,
  unreadNotifications,
  notificationCursor,
  parseNotificationCursor,
} from "@/lib/notification-inbox";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string | string[];
    cursor?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const unread = params.filter === "unread";
  const cursor = parseNotificationCursor(params.cursor);
  const s = await getSession();
  const [result, unreadCount] = s
    ? await Promise.all([
        db()
          .select({
            ...getTableColumns(notifications),
            cursorCreatedAt: sql<string>`to_char(${notifications.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          })
          .from(notifications)
          .where(
            and(
              unread
                ? unreadNotifications(s.user.id)
                : notificationAccess(s.user.id),
              cursor
                ? sql`(${notifications.createdAt},${notifications.id}) < (${cursor.createdAt}::timestamptz,${cursor.id}::uuid)`
                : undefined,
            ),
          )
          .orderBy(desc(notifications.createdAt), desc(notifications.id))
          .limit(31),
        db()
          .select({ total: count() })
          .from(notifications)
          .where(unreadNotifications(s.user.id)),
      ])
    : [[], [{ total: 0 }]];
  const rows = result.slice(0, 30);
  const unreadIds = rows.filter((n) => !n.readAt).map((n) => n.id);
  const next =
    result.length > 30 && rows.length
      ? notificationCursor({
          id: rows[rows.length - 1].id,
          createdAt: rows[rows.length - 1].cursorCreatedAt,
        })
      : null;
  const base = "/app/notifications";
  return (
    <>
      <div className="page-title">
        <div>
          <h1>
            <Text value={"Notifications"} />
          </h1>
          <p>New opportunities and changes in the problems you track.</p>
        </div>
      </div>
      <div className="notification-controls">
        <nav aria-label="Notification filter" className="notification-controls">
          <Link
            className="button button-outline"
            href={base}
            aria-current={!unread ? "page" : undefined}
          >
            <Text value={"All"} />
          </Link>
          <Link
            className="button button-outline"
            href={base + "?filter=unread"}
            aria-current={unread ? "page" : undefined}
          >
            Unread ({unreadCount[0].total})
          </Link>
        </nav>
        {unreadIds.length > 0 && (
          <ApiButton
            key={unreadIds.join(",")}
            endpoint="/api/notifications"
            payload={{ ids: unreadIds }}
            label="Mark shown as read"
          />
        )}
      </div>
      <div className="panel">
        {rows.length ? (
          rows.map((n) => (
            <article className="report-row" key={n.id}>
              <div>
                <span className="badge">
                  {n.type.replaceAll("_", " ")}
                  {n.readAt ? " · read" : ""}
                </span>
                <h3 style={{ marginTop: 12 }}>{n.title}</h3>
                <p className="text-small wrap">{n.body}</p>
                <time
                  className="text-small muted notification-date"
                  dateTime={n.createdAt.toISOString()}
                >
                  {n.createdAt.toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "UTC",
                  })}{" "}
                  UTC
                </time>
                {n.opportunityId && (
                  <Link
                    className="text-link"
                    href={
                      "/app/opportunities/" +
                      n.opportunityId +
                      (n.workspaceId ? "?workspace=" + n.workspaceId : "")
                    }
                  >
                    Open opportunity ↗
                  </Link>
                )}
              </div>
              {!n.readAt && (
                <ApiButton
                  endpoint="/api/notifications"
                  payload={{ id: n.id }}
                  label="Mark read"
                />
              )}
            </article>
          ))
        ) : (
          <EmptyState
            title={
              unread
                ? "You're all caught up."
                : cursor
                  ? "No older notifications."
                  : "No notifications yet."
            }
            description="Notifications appear when your radars match new evidence or meaningful changes."
          />
        )}
      </div>
      <nav aria-label="Notification history" className="notification-controls">
        {cursor && (
          <Link
            className="text-link"
            href={base + (unread ? "?filter=unread" : "")}
          >
            Back to latest
          </Link>
        )}
        {next && (
          <Link
            className="text-link"
            href={
              base + "?" + (unread ? "filter=unread&" : "") + "cursor=" + next
            }
          >
            Older notifications →
          </Link>
        )}
      </nav>
    </>
  );
}
