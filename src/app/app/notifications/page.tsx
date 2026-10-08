import Link from "next/link";
import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { ApiButton } from "@/components/actions";
import { EmptyState } from "@/components/empty-state";
export default async function Page() {
  const s = await getSession();
  const rows = s
    ? await db()
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, s.user.id),
            sql`(${notifications.workspaceId} is null or workspace_role(${notifications.workspaceId},${s.user.id}) is not null)`,
          ),
        )
        .orderBy(desc(notifications.createdAt))
        .limit(100)
    : [];
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Notifications</h1>
          <p>New opportunities and changes in the problems you track.</p>
        </div>
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
                <p className="text-small">{n.body}</p>
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
            title="You're all caught up."
            description="Notifications appear when your radars match new evidence or meaningful changes."
          />
        )}
      </div>
    </>
  );
}
