import { sql } from "drizzle-orm";
import { z } from "zod";
import { db, databaseReady } from "@/db";
import { ApiError, userPlan } from "./security";
export type WorkspaceRole = "admin" | "editor" | "viewer";
export type TeamRole = "owner" | "admin" | "member";
export function permits(
  role: WorkspaceRole | null,
  action: "read" | "edit" | "admin",
) {
  return (
    !!role &&
    (action === "read" ||
      (action === "edit" && role !== "viewer") ||
      (action === "admin" && role === "admin"))
  );
}
export async function requireAgency(userId: string) {
  if ((await userPlan(userId)) !== "agency")
    throw new ApiError(403, "An active Agency subscription is required.");
}
export async function requireTeam(
  teamId: string,
  userId: string,
  admin = false,
) {
  if (!z.uuid().safeParse(teamId).success)
    throw new ApiError(400, "Invalid team ID");
  const result = await db().execute(
    sql`select t.id,t.name,t.owner_id,case when t.owner_id=${userId} then 'owner' else tm.role end as role from teams t join team_members tm on tm.team_id=t.id and tm.user_id=${userId} where t.id=${teamId}::uuid`,
  );
  const t = result.rows[0];
  if (!t) throw new ApiError(404, "Team not found.");
  await requireAgency(String(t.owner_id));
  if (admin && !["owner", "admin"].includes(String(t.role)))
    throw new ApiError(403, "Team administrator access required.");
  return t as unknown as {
    id: string;
    name: string;
    owner_id: string;
    role: TeamRole;
  };
}
export async function requireWorkspace(
  workspaceId: string,
  userId: string,
  action: "read" | "edit" | "admin" = "read",
) {
  if (!z.uuid().safeParse(workspaceId).success)
    throw new ApiError(400, "Invalid workspace ID");
  const result = await db().execute(
    sql`select w.*,workspace_role(w.id,${userId}) as role from workspaces w where w.id=${workspaceId}::uuid and workspace_role(w.id,${userId}) is not null`,
  );
  const w = result.rows[0];
  if (!w)
    throw new ApiError(404, "Workspace not found or access is unavailable.");
  if (!permits(w.role as WorkspaceRole, action))
    throw new ApiError(403, "Your workspace role does not allow this action.");
  return w as unknown as {
    id: string;
    team_id: string;
    name: string;
    client_name: string;
    brand_name: string;
    brand_color: string;
    role: WorkspaceRole;
  };
}
export async function workspaceAudience(id: string) {
  const result = await db().execute(
    sql`select u.id,u.email from users u where workspace_role(${id}::uuid,u.id) is not null`,
  );
  return result.rows as unknown as { id: string; email: string }[];
}
export async function availableTeams(userId: string) {
  if (!databaseReady()) return [];
  const r = await db().execute(
    sql`select t.id,t.name,t.owner_id,case when t.owner_id=${userId} then 'owner' else tm.role end as role from teams t join team_members tm on tm.team_id=t.id and tm.user_id=${userId} order by t.created_at`,
  );
  return r.rows as unknown as {
    id: string;
    name: string;
    owner_id: string;
    role: TeamRole;
  }[];
}
export async function availableWorkspaces(userId: string) {
  if (!databaseReady()) return [];
  const r = await db().execute(
    sql`select w.id,w.name,w.client_name,w.team_id,workspace_role(w.id,${userId}) as role from workspaces w where workspace_role(w.id,${userId}) is not null order by w.created_at`,
  );
  return r.rows as unknown as {
    id: string;
    name: string;
    client_name: string;
    team_id: string;
    role: WorkspaceRole;
  }[];
}
