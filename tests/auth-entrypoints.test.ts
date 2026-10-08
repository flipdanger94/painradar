import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ handler: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: state.auth }));
vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: () => ({ GET: state.handler, POST: state.handler }),
}));
import { GET, POST } from "@/app/api/auth/[...all]/route";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgresql://fixture");
  vi.stubEnv("BETTER_AUTH_SECRET", "fixture-secret");
  vi.stubEnv("BETTER_AUTH_URL", "https://painradar.example");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("EMAIL_FROM", "");
  state.handler.mockResolvedValue(Response.json({ ok: true }));
});
afterEach(() => vi.unstubAllEnvs());
const request = (path: string) =>
  new Request("https://painradar.example/api/auth" + path, { method: "POST" });
describe("authentication setup boundaries", () => {
  it.each(["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"])(
    "rejects missing %s with a client-readable error",
    async (key) => {
      vi.stubEnv(key, "");
      const response = await POST(request("/sign-in/email"));
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        code: "AUTH_UNAVAILABLE",
        message: expect.any(String),
      });
      expect(state.auth).not.toHaveBeenCalled();
    },
  );
  it.each([
    "/sign-up/email",
    "/request-password-reset",
    "/send-verification-email",
  ])("does not start %s when mail is unavailable", async (path) => {
    const response = await POST(request(path));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "EMAIL_UNAVAILABLE" });
    expect(state.handler).not.toHaveBeenCalled();
  });
  it("allows existing users to sign in without mail setup", async () => {
    expect((await POST(request("/sign-in/email"))).status).toBe(200);
    expect(state.handler).toHaveBeenCalledOnce();
  });
  it("allows session reads without mail setup", async () => {
    expect(
      (await GET(new Request("https://painradar.example/api/auth/get-session")))
        .status,
    ).toBe(200);
  });
  it("passes configured registrations to Better Auth", async () => {
    vi.stubEnv("RESEND_API_KEY", "fixture");
    vi.stubEnv("EMAIL_FROM", "fixture@example.test");
    expect((await POST(request("/sign-up/email"))).status).toBe(200);
    expect(state.handler).toHaveBeenCalledOnce();
  });
  it("does not expose provider exceptions to the client", async () => {
    state.handler.mockRejectedValueOnce(new Error("private provider error"));
    const response = await POST(request("/sign-in/email"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private provider error");
  });
});
