import Link from "next/link";
import { sql } from "drizzle-orm";
import { db, databaseReady } from "@/db";
import { getSession } from "@/lib/auth";
import { availableTeams, availableWorkspaces } from "@/lib/tenancy";
import { userPlan } from "@/lib/security";
import { TeamForm } from "@/components/team-form";
import { ApiButton } from "@/components/actions";
import { EmptyState } from "@/components/empty-state";
export default async function Page() {
  const s = await getSession();
  if (!s || !databaseReady())
    return (
      <>
        <div className="page-title">
          <h1>Teams & client workspaces</h1>
        </div>
        <EmptyState
          title="Your team workspace"
          description="Log in to manage teams and client workspaces."
          action={{ href: "/login", label: "Log in" }}
        />
      </>
    );
  const [teams, workspaces, plan] = await Promise.all([
    availableTeams(s.user.id),
    availableWorkspaces(s.user.id),
    userPlan(s.user.id),
  ]);
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Teams & client workspaces</h1>
          <p>
            Agency owners sponsor access. Members see only assigned clients;
            administrators see all clients in their team.
          </p>
        </div>
      </div>
      {teams.map(async (t) => {
        const active = (await userPlan(t.owner_id)) === "agency";
        const admin = active && ["owner", "admin"].includes(t.role);
        const members = admin
          ? (
              await db().execute(
                sql`select u.id,u.name,u.email,m.role from team_members m join users u on u.id=m.user_id where m.team_id=${t.id}::uuid`,
              )
            ).rows
          : [];
        const invites = admin
          ? (
              await db().execute(
                sql`select id,email,role,expires_at from team_invites where team_id=${t.id}::uuid and accepted_at is null and revoked_at is null and expires_at>now()`,
              )
            ).rows
          : [];
        return (
          <section className="panel detail-block" key={t.id}>
            <h2>{t.name}</h2>
            <p>
              Your role: {t.role}
              {!active ? " · Owner's Agency subscription is inactive" : ""}
            </p>
            <div className="opportunity-grid">
              {workspaces
                .filter((w) => w.team_id === t.id)
                .map((w) => (
                  <Link
                    className="opportunity-card"
                    key={w.id}
                    href={"/app/workspaces/" + w.id}
                  >
                    <h3>{w.name}</h3>
                    <p>
                      {w.client_name} · {w.role}
                    </p>
                  </Link>
                ))}
            </div>
            {admin && (
              <>
                <h3>Create a client workspace</h3>
                <TeamForm
                  endpoint="/api/workspaces"
                  payload={{ teamId: t.id }}
                  label="Create workspace"
                  fields={[
                    { name: "name", label: "Workspace name" },
                    { name: "clientName", label: "Client name" },
                    {
                      name: "brandName",
                      label: "Report brand name",
                      value: t.name,
                    },
                    {
                      name: "brandColor",
                      label: "Brand color",
                      type: "color",
                      value: "#a58bff",
                    },
                  ]}
                />
                <h3>Invite a team member</h3>
                <p className="text-small">
                  Share the returned invitation link with the intended
                  recipient. It expires after seven days and requires their
                  verified email.
                </p>
                <TeamForm
                  endpoint={"/api/teams/" + t.id + "/invites"}
                  label="Create invitation"
                  resultKey="url"
                  fields={[
                    { name: "email", label: "Recipient email", type: "email" },
                    {
                      name: "role",
                      label: "Role",
                      options: [
                        { value: "member", label: "Member" },
                        ...(t.role === "owner"
                          ? [{ value: "admin", label: "Administrator" }]
                          : []),
                      ],
                    },
                  ]}
                />
                <h3>Members</h3>
                {members.map((m) => (
                  <div className="report-row" key={String(m.id)}>
                    <div>
                      {String(m.name)} · {String(m.email)} ·{" "}
                      {String(m.id) === t.owner_id ? "owner" : String(m.role)}
                    </div>
                    {String(m.id) !== t.owner_id &&
                      (t.role === "owner" || m.role === "member") && (
                        <div>
                          <ApiButton
                            endpoint={"/api/teams/" + t.id + "/members"}
                            payload={{ userId: m.id, action: "remove" }}
                            label="Remove member"
                          />
                          {t.role === "owner" && (
                            <ApiButton
                              endpoint={"/api/teams/" + t.id + "/members"}
                              payload={{
                                userId: m.id,
                                action: "role",
                                role: m.role === "admin" ? "member" : "admin",
                              }}
                              label={
                                m.role === "admin"
                                  ? "Make member"
                                  : "Make administrator"
                              }
                            />
                          )}
                        </div>
                      )}
                  </div>
                ))}
                <h3>Pending invitations</h3>
                {invites.map((i) => (
                  <div className="report-row" key={String(i.id)}>
                    <span>
                      {String(i.email)} · {String(i.role)}
                    </span>
                    <ApiButton
                      endpoint={"/api/teams/" + t.id + "/invites"}
                      method="DELETE"
                      payload={{ inviteId: i.id }}
                      label="Revoke invitation"
                    />
                  </div>
                ))}
              </>
            )}
          </section>
        );
      })}
      {plan === "agency" && !teams.some((t) => t.owner_id === s.user.id) && (
        <section className="panel detail-block">
          <h2>Create your agency team</h2>
          <TeamForm
            endpoint="/api/teams"
            fields={[{ name: "name", label: "Agency name" }]}
            label="Create team"
          />
        </section>
      )}
      {!teams.length && plan !== "agency" && (
        <EmptyState
          title="Join a team or choose Agency"
          description="An Agency owner can invite your verified email. Your personal subscription is independent of sponsored workspace access."
          action={{ href: "/pricing", label: "View plans" }}
        />
      )}
    </>
  );
}
