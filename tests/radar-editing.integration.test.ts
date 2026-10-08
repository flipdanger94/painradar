import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFileSync, readdirSync } from "node:fs";
let pg: PGlite;
const personal = "a0000000-0000-4000-8000-000000000001";
const team = "a0000000-0000-4000-8000-000000000002";
const workspace = "a0000000-0000-4000-8000-000000000003";
const shared = "a0000000-0000-4000-8000-000000000004";
beforeAll(async () => {
  pg = new PGlite({ extensions: { vector } });
  for (const f of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(readFileSync("drizzle/" + f, "utf8"));
  for (const u of ["owner", "editor", "viewer", "outside"])
    await pg.query(
      "insert into users(id,name,email,email_verified) values($1,'Fixture',$2,true)",
      [u, u + "@example.test"],
    );
  await pg.exec(
    "insert into subscriptions(user_id,plan,status) values('owner','agency','active')",
  );
  await pg.query("select create_agency_team($1,'owner','Team')", [team]);
  await pg.query(
    "select create_client_workspace($1,$2,'owner','Client','Client','Brand','#a58bff')",
    [workspace, team],
  );
  for (const u of ["editor", "viewer"]) {
    await pg.query(
      "insert into team_members(team_id,user_id,role) values($1,$2,'member')",
      [team, u],
    );
    await pg.query("select set_workspace_member($1,'owner',$2,$2)", [
      workspace,
      u,
    ]);
  }
  await pg.query(
    "insert into radars(id,user_id,workspace_id,name) values($1,'owner',null,'Original'),($2,'owner',$3,'Shared')",
    [personal, shared, workspace],
  );
  await pg.query(
    "insert into radar_keywords(radar_id,keyword) values($1,'old'),($1,'retained')",
    [personal],
  );
});
afterAll(async () => pg?.close());
async function update(
  id = personal,
  actor = "owner",
  ws: string | null = null,
  threshold = 75,
) {
  return (
    await pg.query<{ id: string | null }>(
      "select update_radar($1,$2,$3,'Updated','[\"hiring\"]','[]','[\"hn\"]','[\"en\"]',$4,'weekly','[\"retained\",\"new\",\"new\"]') as id",
      [id, actor, ws, threshold],
    )
  ).rows[0].id;
}
describe("Atomic radar editing", () => {
  it("retains identity, replaces keywords, and audits the update", async () => {
    expect(await update()).toBe(personal);
    expect(
      (
        await pg.query(
          "select name,alert_threshold,frequency from radars where id=$1",
          [personal],
        )
      ).rows[0],
    ).toEqual({ name: "Updated", alert_threshold: 75, frequency: "weekly" });
    expect(
      (
        await pg.query<{ keyword: string }>(
          "select keyword from radar_keywords where radar_id=$1 order by keyword",
          [personal],
        )
      ).rows.map((r) => r.keyword),
    ).toEqual(["new", "retained"]);
    expect(
      (await pg.query("select * from audit_logs where action='radar.updated'"))
        .rows,
    ).toHaveLength(1);
  });
  it("rejects foreign users and scope switching", async () => {
    expect(await update(personal, "outside")).toBeNull();
    expect(await update(personal, "owner", workspace)).toBeNull();
    expect(await update(shared, "owner")).toBeNull();
  });
  it("permits workspace editors but rejects viewers and revoked membership", async () => {
    expect(await update(shared, "viewer", workspace)).toBeNull();
    expect(await update(shared, "outside", workspace)).toBeNull();
    expect(await update(shared, "editor", workspace)).toBe(shared);
    await pg.query(
      "select set_workspace_member($1,'owner','editor','remove')",
      [workspace],
    );
    expect(await update(shared, "editor", workspace)).toBeNull();
  });
  it("rolls back all changes when database validation fails", async () => {
    await expect(update(personal, "owner", null, 101)).rejects.toThrow();
    expect(
      (
        await pg.query("select alert_threshold from radars where id=$1", [
          personal,
        ])
      ).rows[0],
    ).toEqual({ alert_threshold: 75 });
  });
});
