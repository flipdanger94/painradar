import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc, sql, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { radars, workspaceReports, apiKeys } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { ApiError } from "@/lib/security";
import { requireWorkspace } from "@/lib/tenancy";
import { workspaceSaved } from "@/lib/workspace-data";
import { TeamForm } from "@/components/team-form";
import { RadarForm } from "@/components/radar-form";
import { ApiKeyForm } from "@/components/api-key-form";
import { ApiButton, SaveButton } from "@/components/actions";
import { OpportunityCard } from "@/components/opportunity-card";
import { EmptyState } from "@/components/empty-state";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await getSession();
  if (!s) notFound();
  let w;
  try {
    w = await requireWorkspace(id, s.user.id);
  } catch (e) {
    if (e instanceof ApiError) notFound();
    throw e;
  }
  const edit = w.role !== "viewer";
  const [saved, rs, reps, keys] = await Promise.all([
    workspaceSaved(id),
    db().select().from(radars).where(eq(radars.workspaceId, id)),
    db()
      .select()
      .from(workspaceReports)
      .where(eq(workspaceReports.workspaceId, id))
      .orderBy(desc(workspaceReports.endDay))
      .limit(30),
    edit
      ? db()
          .select({
            id: apiKeys.id,
            name: apiKeys.name,
            userId: apiKeys.userId,
          })
          .from(apiKeys)
          .where(and(eq(apiKeys.workspaceId, id), isNull(apiKeys.revokedAt)))
      : Promise.resolve([]),
  ]);
  const members =
    w.role === "admin"
      ? (
          await db().execute(
            sql`select u.id,u.email,m.role from team_members tm join users u on u.id=tm.user_id left join workspace_members m on m.user_id=tm.user_id and m.workspace_id=${id}::uuid where tm.team_id=${w.team_id}::uuid`,
          )
        ).rows
      : [];
  const hooks =
    w.role === "admin"
      ? (
          await db().execute(
            sql`select id,name,url,enabled from outbound_webhooks where workspace_id=${id}::uuid order by created_at desc`,
          )
        ).rows
      : [];
  const deliveries =
    w.role === "admin"
      ? (
          await db().execute(
            sql`select d.id,d.status,d.attempts,d.last_status,d.last_error,h.name from webhook_deliveries d join outbound_webhooks h on h.id=d.webhook_id where h.workspace_id=${id}::uuid order by d.created_at desc limit 30`,
          )
        ).rows
      : [];
  return (
    <>
      <Link className="text-link" href="/app/teams">
        ← Teams
      </Link>
      <div className="page-title">
        <div>
          <h1>{w.name}</h1>
          <p>
            {w.client_name} · Your role: {w.role}
          </p>
        </div>
      </div>
      <section className="panel detail-block">
        <h2>Shared watchlist</h2>
        <p>
          Open any opportunity with this workspace selected to add it for the
          client.
        </p>
        <Link className="text-link" href={"/app/trending?workspace=" + id}>
          Find opportunities →
        </Link>
        <div className="opportunity-grid">
          {saved.map((r) => (
            <div key={r.opportunity.id}>
              <OpportunityCard o={r.opportunity} workspaceId={id} />
              {edit && (
                <SaveButton id={r.opportunity.id} workspaceId={id} saved />
              )}
            </div>
          ))}
        </div>
        {!saved.length && <EmptyState title="No saved opportunities yet" />}
      </section>
      <section className="panel detail-block">
        <h2>Client radars</h2>
        {rs.map((r) => (
          <div className="report-row" key={r.id}>
            <span>
              {r.name} · {r.frequency}
            </span>
            {edit && (
              <ApiButton
                endpoint="/api/radars"
                method="DELETE"
                payload={{ id: r.id }}
                label="Delete radar"
              />
            )}
          </div>
        ))}
        {edit && <RadarForm workspaceId={id} />}
      </section>
      <section className="panel detail-block">
        <h2>Client reports</h2>
        <p>
          Snapshots contain up to 500 of this client’s saved opportunities,
          ranked by score. Exports use the client brand and include evidence
          labels.
        </p>
        {edit && (
          <ApiButton
            endpoint={"/api/workspaces/" + id + "/reports"}
            label="Generate available reports"
          />
        )}
        {reps.map((r) => (
          <div className="report-row" key={r.id}>
            <span>
              {r.period} · {r.startDay} – {r.endDay} · {r.content.length}{" "}
              opportunities
            </span>
            <a
              className="text-link"
              href={"/api/workspaces/" + id + "/reports?reportId=" + r.id}
            >
              Download branded report ↗
            </a>
          </div>
        ))}
      </section>
      {edit && (
        <section className="panel detail-block">
          <h2>Workspace API keys</h2>
          <p>
            These keys return only opportunities saved in this client workspace.
            Keys stop working when their creator loses workspace access.
          </p>
          <ApiKeyForm workspaceId={id} />
          {keys
            .filter((k) => k.userId === s.user.id || w.role === "admin")
            .map((k) => (
              <div className="report-row" key={k.id}>
                <span>{k.name}</span>
                <ApiButton
                  endpoint="/api/keys"
                  method="DELETE"
                  payload={{ id: k.id }}
                  label="Revoke key"
                />
              </div>
            ))}
        </section>
      )}
      {w.role === "admin" && (
        <>
          <section className="panel detail-block">
            <h2>Outbound webhooks</h2>
            <p>
              HTTPS delivery of radar changes, competitor research and report
              events. The signing secret is shown once. Receivers must validate
              the timestamp and HMAC signature and deduplicate by delivery ID.
            </p>
            <TeamForm
              endpoint={"/api/workspaces/" + id + "/webhooks"}
              label="Create webhook"
              resultKey="secret"
              fields={[
                { name: "name", label: "Integration name" },
                { name: "url", label: "Public HTTPS endpoint", type: "url" },
              ]}
            />
            {hooks.map((h) => (
              <div className="report-row" key={String(h.id)}>
                <span className="wrap">
                  {String(h.name)} · {String(h.url)} ·{" "}
                  {h.enabled ? "enabled" : "disabled"}
                </span>
                {!!h.enabled && (
                  <ApiButton
                    endpoint={"/api/workspaces/" + id + "/webhooks"}
                    method="DELETE"
                    payload={{ webhookId: h.id }}
                    label="Disable webhook"
                  />
                )}
              </div>
            ))}
            <h3>Recent deliveries</h3>
            {deliveries.map((d) => (
              <p className="text-small wrap" key={String(d.id)}>
                {String(d.name)} · {String(d.status)} · {String(d.attempts)}{" "}
                attempts · {String(d.last_status || d.last_error || "Queued")}
              </p>
            ))}
          </section>
          <section className="panel detail-block">
            <h2>Branding</h2>
            <TeamForm
              endpoint={"/api/workspaces/" + id}
              method="PATCH"
              label="Save branding"
              fields={[
                { name: "name", label: "Workspace name", value: w.name },
                {
                  name: "clientName",
                  label: "Client name",
                  value: w.client_name,
                },
                {
                  name: "brandName",
                  label: "Report brand name",
                  value: w.brand_name,
                },
                {
                  name: "brandColor",
                  label: "Brand color",
                  type: "color",
                  value: w.brand_color,
                },
              ]}
            />
          </section>
          <section className="panel detail-block">
            <h2>Assign team members</h2>
            <p>
              Team administrators already have access. Assign other members to
              this client as editors or viewers.
            </p>
            {members.length > 0 && (
              <TeamForm
                endpoint={"/api/workspaces/" + id + "/members"}
                label="Update client access"
                fields={[
                  {
                    name: "userId",
                    label: "Team member",
                    options: members.map((m) => ({
                      value: String(m.id),
                      label:
                        String(m.email) +
                        " · " +
                        String(m.role || "unassigned"),
                    })),
                  },
                  {
                    name: "role",
                    label: "Workspace role",
                    options: [
                      { value: "viewer", label: "Viewer" },
                      { value: "editor", label: "Editor" },
                      { value: "remove", label: "Remove assignment" },
                    ],
                  },
                ]}
              />
            )}
          </section>
        </>
      )}
    </>
  );
}
