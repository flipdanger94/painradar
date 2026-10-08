import { sql } from "drizzle-orm";
import { db } from "@/db";
import { generateWorkspaceReports } from "./workspace-data";
export async function enqueuePublications(day: string) {
  const r = await db().execute(
    sql`select enqueue_publications(${day}::date) as count`,
  );
  return Number(r.rows[0]?.count || 0);
}
export async function claimPublications(token: string) {
  const r = await db().execute(
    sql`select id,kind,workspace_id,day::text as day from claim_publications(${token}::uuid,5)`,
  );
  return r.rows.map((r) => ({
    id: String(r.id),
    kind: String(r.kind),
    workspaceId: r.workspace_id ? String(r.workspace_id) : null,
    day: String(r.day),
  }));
}
export async function processPublication(id: string, token: string) {
  const r = await db().execute(
    sql`select * from process_radar_publication(${id}::uuid,${token}::uuid,100)`,
  );
  const row = r.rows[0];
  return {
    complete: Boolean(row?.complete),
    leaseLost: Boolean(row?.lease_lost),
    scanned: Number(row?.scanned || 0),
    created: Number(row?.created || 0),
  };
}
export async function publishWorkspace(
  id: string,
  token: string,
  workspaceId: string,
  day: string,
) {
  const r = await db().execute(
    sql`select id from publication_jobs where id=${id}::uuid and workspace_id=${workspaceId}::uuid and day=${day}::date and exists(select 1 from workspaces w join teams t on t.id=w.team_id where w.id=workspace_id and agency_active(t.owner_id)) and kind='workspace' and status='pending' and lease_token=${token}::uuid and lease_until>now()`,
  );
  if (!r.rows.length) {
    await releasePublication(id, token);
    return { leaseLost: true };
  }
  await generateWorkspaceReports(workspaceId, day);
  const updated = await db().execute(
    sql`update publication_jobs set status='completed',completed_at=now(),lease_token=null,lease_until=null,updated_at=now(),last_error=null where id=${id}::uuid and lease_token=${token}::uuid and lease_until>now() and exists(select 1 from workspaces w join teams t on t.id=w.team_id where w.id=workspace_id and agency_active(t.owner_id)) returning id`,
  );
  if (!updated.rows.length) await releasePublication(id, token);
  return { leaseLost: !updated.rows.length };
}
export async function releasePublication(id: string, token: string) {
  await db().execute(
    sql`update publication_jobs set lease_token=null,lease_until=null,updated_at=now() where id=${id}::uuid and lease_token=${token}::uuid and status='pending'`,
  );
}
