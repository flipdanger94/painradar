import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
const state = vi.hoisted(() => ({ authenticated: true, revoke: vi.fn() }));
let pg: PGlite;
let testDb: ReturnType<typeof drizzle>;
vi.mock("@/db", () => ({ db: () => testDb }));
vi.mock("@/lib/auth", () => ({
  getSession: async () =>
    state.authenticated
      ? { user: { id: "owner" }, session: { id: "current" } }
      : null,
  auth: () => ({ api: { revokeSession: state.revoke } }),
}));
vi.mock("@/lib/security", async (original) => ({
  ...(await original<object>()),
  rateLimit: vi.fn(),
}));
import { GET, DELETE } from "@/app/api/account/sessions/route";
beforeAll(async () => {
  pg = new PGlite();
  testDb = drizzle(pg);
  await pg.exec(
    "CREATE TABLE sessions (id text PRIMARY KEY, user_id text NOT NULL, token text NOT NULL UNIQUE, expires_at timestamp NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), ip_address text, user_agent text)",
  );
});
afterAll(async () => {
  await pg.close();
  vi.unstubAllEnvs();
});
beforeEach(async () => {
  vi.clearAllMocks();
  state.authenticated = true;
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://painradar.example");
  await pg.exec(
    "DELETE FROM sessions; INSERT INTO sessions(id,user_id,token,expires_at,user_agent) VALUES ('current','owner','current-secret',now()+interval '1 day','Current browser'),('other','owner','other-secret',now()+interval '1 day','Other browser'),('foreign','outside','foreign-secret',now()+interval '1 day','Foreign browser'),('expired','owner','expired-secret',now()-interval '1 day','Expired browser')",
  );
  state.revoke.mockImplementation(
    async ({ body }: { body: { token: string } }) => {
      await pg.query("DELETE FROM sessions WHERE token=$1", [body.token]);
      return { status: true };
    },
  );
});
const get = () =>
  GET(new Request("https://painradar.example/api/account/sessions"));
const remove = (id: string, origin = "https://painradar.example") =>
  DELETE(
    new Request("https://painradar.example/api/account/sessions", {
      method: "DELETE",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }),
  );
describe("account session ownership", () => {
  it("rejects guests", async () => {
    state.authenticated = false;
    expect((await get()).status).toBe(401);
    expect((await remove("other")).status).toBe(401);
  });
  it("lists only active owned sessions without bearer tokens", async () => {
    const response = await get();
    const data = await response.json();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(data.sessions.map((row: { id: string }) => row.id).sort()).toEqual([
      "current",
      "other",
    ]);
    expect(
      data.sessions.find((row: { id: string }) => row.id === "current").current,
    ).toBe(true);
    expect(JSON.stringify(data)).not.toContain("secret");
  });
  it("cannot revoke another user's session", async () => {
    expect((await remove("foreign")).status).toBe(404);
    expect(state.revoke).not.toHaveBeenCalled();
    expect(
      (await pg.query("SELECT id FROM sessions WHERE id='foreign'")).rows,
    ).toHaveLength(1);
  });
  it("ends an owned session through Better Auth", async () => {
    expect((await remove("other")).status).toBe(200);
    expect(state.revoke).toHaveBeenCalledWith(
      expect.objectContaining({ body: { token: "other-secret" } }),
    );
    expect(
      (await pg.query("SELECT id FROM sessions WHERE id='other'")).rows,
    ).toHaveLength(0);
  });
  it("preserves the current session", async () => {
    expect((await remove("current")).status).toBe(400);
    expect(state.revoke).not.toHaveBeenCalled();
  });
  it("rejects cross-origin revocations", async () => {
    expect((await remove("other", "https://outside.example")).status).toBe(403);
    expect(state.revoke).not.toHaveBeenCalled();
  });
});
