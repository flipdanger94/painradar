import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { readFileSync, readdirSync } from "node:fs";
import { permits } from "@/lib/tenancy";
let pg: PGlite;
const teamA = "a0000000-0000-4000-8000-000000000001",
  teamB = "b0000000-0000-4000-8000-000000000001";
const wsA = "a0000000-0000-4000-8000-000000000002",
  wsB = "b0000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  pg = new PGlite({ extensions: { vector } });
  for (const f of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(readFileSync("drizzle/" + f, "utf8"));
  for (const u of [
    "owner-a",
    "owner-b",
    "editor",
    "viewer",
    "outside",
    "other-team",
    "admin",
  ])
    await pg.query(
      "insert into users(id,name,email,email_verified) values($1,'Test fixture',$2,true)",
      [u, u + "@example.test"],
    );
  await pg.exec(
    "insert into subscriptions(user_id,plan,status) values('owner-a','agency','active'),('owner-b','agency','active')",
  );
  await pg.query(
    "select create_agency_team($1,'owner-a','Agency A'),create_agency_team($2,'owner-b','Agency B')",
    [teamA, teamB],
  );
  await pg.query(
    "select create_client_workspace($1,$2,'owner-a','A','A Client','A Brand','#a58bff'),create_client_workspace($3,$4,'owner-b','B','B Client','B Brand','#008800')",
    [wsA, teamA, wsB, teamB],
  );
  for (const u of ["editor", "viewer", "admin"])
    await pg.query(
      "insert into team_members(team_id,user_id,role) values($1,$2,$3)",
      [teamA, u, u === "admin" ? "admin" : "member"],
    );
  await pg.query(
    "insert into team_members(team_id,user_id) values($1,'other-team')",
    [teamB],
  );
  await pg.query(
    "select set_workspace_member($1,'owner-a','editor','editor'),set_workspace_member($1,'owner-a','viewer','viewer')",
    [wsA],
  );
});
afterAll(async () => pg?.close());
async function role(w: string, u: string) {
  return (
    await pg.query<{ role: string | null }>(
      "select workspace_role($1,$2) as role",
      [w, u],
    )
  ).rows[0].role;
}
describe("Agency tenant boundaries", () => {
  it("grants team sponsor entitlements only to assigned members", async () => {
    expect(await role(wsA, "editor")).toBe("editor");
    expect(await role(wsA, "viewer")).toBe("viewer");
    expect(await role(wsA, "admin")).toBe("admin");
    expect(await role(wsA, "owner-a")).toBe("admin");
  });
  it("does not expose another client/team to guessed IDs", async () => {
    expect(await role(wsB, "editor")).toBeNull();
    expect(await role(wsA, "owner-b")).toBeNull();
    expect(await role(wsA, "outside")).toBeNull();
  });
  it("forbids cross-team workspace assignment at SQL and FK levels", async () => {
    expect(
      (
        await pg.query<{ allowed: boolean }>(
          "select set_workspace_member($1,'owner-a','other-team','editor') as allowed",
          [wsA],
        )
      ).rows[0].allowed,
    ).toBe(false);
    await expect(
      pg.query(
        "insert into workspace_members(workspace_id,team_id,user_id,role) values($1,$2,'other-team','editor')",
        [wsA, teamB],
      ),
    ).rejects.toThrow();
  });
  it("blocks viewers from creating radars even when they guess mutation URLs", async () => {
    const r = await pg.query<{ id: string | null }>(
      "select create_workspace_radar_limited(gen_random_uuid(),$1,'viewer','Fixture radar','[]','[]','[\"hn\"]','[\"en\"]',60,'daily','[\"pain\"]') as id",
      [wsA],
    );
    expect(r.rows[0].id).toBeNull();
    expect(permits("viewer", "edit")).toBe(false);
    expect(permits("editor", "admin")).toBe(false);
    expect(permits("editor", "edit")).toBe(true);
  });
  it("makes workspace watchlists independent of personal unique user watchlists", async () => {
    await pg.query("insert into watchlists(user_id) values('editor')");
    expect(
      (await pg.query("select * from watchlists where workspace_id=$1", [wsA]))
        .rows,
    ).toHaveLength(1);
    expect(
      (
        await pg.query(
          "select * from watchlists where user_id='editor' and workspace_id is null",
        )
      ).rows,
    ).toHaveLength(1);
    await expect(
      pg.query(
        "insert into watchlists(user_id,workspace_id) values('outside',$1)",
        [wsA],
      ),
    ).rejects.toThrow();
  });
  it("keeps owner membership immutable and prevents admin escalation", async () => {
    const r = await pg.query<{ allowed: boolean }>(
      "select manage_team_member($1,'admin','owner-a','remove','member') as allowed",
      [teamA],
    );
    expect(r.rows[0].allowed).toBe(false);
    expect(
      (
        await pg.query<{ allowed: boolean }>(
          "select manage_team_member($1,'admin','viewer','role','admin') as allowed",
          [teamA],
        )
      ).rows[0].allowed,
    ).toBe(false);
  });
  it("binds invitations to verified email and consumes token once", async () => {
    const iid = "a0000000-0000-4000-8000-000000000009";
    await pg.query(
      "select create_team_invite($1,$2,'owner-a','outside@example.test','member','test-only-hash')",
      [iid, teamA],
    );
    expect(
      (
        await pg.query<{ id: string | null }>(
          "select accept_team_invite('test-only-hash','other-team') as id",
        )
      ).rows[0].id,
    ).toBeNull();
    expect(
      (
        await pg.query<{ id: string | null }>(
          "select accept_team_invite('test-only-hash','outside') as id",
        )
      ).rows[0].id,
    ).toBe(teamA);
    expect(
      (
        await pg.query<{ id: string | null }>(
          "select accept_team_invite('test-only-hash','outside') as id",
        )
      ).rows[0].id,
    ).toBeNull();
    expect(await role(wsA, "outside")).toBeNull();
  });
  it("withdraws workspace entitlements when sponsor subscription expires", async () => {
    await pg.exec(
      "update subscriptions set status='canceled' where user_id='owner-b'",
    );
    expect(await role(wsB, "owner-b")).toBeNull();
  });
  it("revokes keys and access on offboarding while preserving workspace records", async () => {
    await pg.query(
      "insert into api_keys(user_id,workspace_id,name,hash,prefix) values('editor',$1,'Test key','test-key-hash','test-prefix')",
      [wsA],
    );
    expect(
      (
        await pg.query<{ allowed: boolean }>(
          "select manage_team_member($1,'owner-a','editor','remove','member') as allowed",
          [teamA],
        )
      ).rows[0].allowed,
    ).toBe(true);
    expect(await role(wsA, "editor")).toBeNull();
    expect(
      (
        await pg.query<{ revoked_at: unknown }>(
          "select revoked_at from api_keys where hash='test-key-hash'",
        )
      ).rows[0].revoked_at,
    ).not.toBeNull();
    expect(
      (await pg.query("select * from watchlists where workspace_id=$1", [wsA]))
        .rows,
    ).toHaveLength(1);
  });
});

describe("Workspace delivery queue integrity", () => {
  const hook = "a0000000-0000-4000-8000-000000000050";
  const delivery = "a0000000-0000-4000-8000-000000000051";
  it("keeps idempotent events scoped to the intended destination", async () => {
    await pg.query(
      "insert into outbound_webhooks(id,workspace_id,name,url,secret_ciphertext,events,created_by) values($1,$2,'Test hook','https://hooks.example.org','test-only-cipher','[\"report_ready\"]','owner-a')",
      [hook, wsA],
    );
    await pg.query(
      "insert into webhook_deliveries(id,webhook_id,event_key,payload) values($1,$2,'test-report','{\"workspaceId\":\"test-fixture\"}')",
      [delivery, hook],
    );
    await expect(
      pg.query(
        "insert into webhook_deliveries(webhook_id,event_key,payload) values($1,'test-report','{}')",
        [hook],
      ),
    ).rejects.toThrow();
  });
  it("leases once, then recovers an expired worker lease", async () => {
    const first = await pg.query<{ id: string; attempts: number }>(
      "select * from claim_webhook_deliveries(10)",
    );
    expect(first.rows).toHaveLength(1);
    expect(first.rows[0].attempts).toBe(1);
    expect(
      (await pg.query("select * from claim_webhook_deliveries(10)")).rows,
    ).toHaveLength(0);
    await pg.query(
      "update webhook_deliveries set lease_until=now()-interval '1 second' where id=$1",
      [delivery],
    );
    expect(
      (
        await pg.query<{ attempts: number }>(
          "select * from claim_webhook_deliveries(10)",
        )
      ).rows[0].attempts,
    ).toBe(2);
  });
  it("pauses disabled hooks and canceled sponsor subscriptions", async () => {
    await pg.query(
      "update webhook_deliveries set status='pending',lease_until=null where id=$1",
      [delivery],
    );
    await pg.query("update outbound_webhooks set enabled=false where id=$1", [
      hook,
    ]);
    expect(
      (await pg.query("select * from claim_webhook_deliveries(10)")).rows,
    ).toHaveLength(0);
    await pg.query("update outbound_webhooks set enabled=true where id=$1", [
      hook,
    ]);
    await pg.exec(
      "update subscriptions set status='canceled' where user_id='owner-a'",
    );
    expect(
      (await pg.query("select * from claim_webhook_deliveries(10)")).rows,
    ).toHaveLength(0);
    await pg.exec(
      "update subscriptions set status='active' where user_id='owner-a'",
    );
  });
  it("respects retry schedule and maximum attempts", async () => {
    await pg.query(
      "update webhook_deliveries set next_attempt_at=now()+interval '1 hour' where id=$1",
      [delivery],
    );
    expect(
      (await pg.query("select * from claim_webhook_deliveries(10)")).rows,
    ).toHaveLength(0);
    await pg.query(
      "update webhook_deliveries set next_attempt_at=now(),attempts=6 where id=$1",
      [delivery],
    );
    expect(
      (await pg.query("select * from claim_webhook_deliveries(10)")).rows,
    ).toHaveLength(0);
  });
});
describe("Workspace report outbox", () => {
  it("commits branded snapshots and delivery events together without duplicate retries", async () => {
    const result = await pg.query<{ id: string }>(
      "select create_workspace_report($1,'daily','2026-10-01','2026-10-02','[{\"title\":\"Test fixture\",\"score\":60}]') as id",
      [wsA],
    );
    const rid = result.rows[0].id;
    expect(rid).toBeTruthy();
    await pg.query(
      "select create_workspace_report($1,'daily','2026-10-01','2026-10-02','[{\"title\":\"Changed fixture\"}]')",
      [wsA],
    );
    expect(
      (
        await pg.query<{ content: { title: string }[] }>(
          "select content from workspace_reports where id=$1",
          [rid],
        )
      ).rows[0].content[0].title,
    ).toBe("Test fixture");
    expect(
      (
        await pg.query("select * from webhook_deliveries where event_key=$1", [
          "report:" + rid,
        ])
      ).rows,
    ).toHaveLength(1);
  });
  it("refuses report writes for an inactive Agency sponsor", async () => {
    expect(
      (
        await pg.query<{ id: string | null }>(
          "select create_workspace_report($1,'daily','2026-10-01','2026-10-02','[]') as id",
          [wsB],
        )
      ).rows[0].id,
    ).toBeNull();
  });
});
