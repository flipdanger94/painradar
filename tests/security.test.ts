import { PATCH as radarPatch } from "@/app/api/radars/route";
import { POST as maintenancePost } from "@/app/api/admin/maintenance/route";
import { describe, it, expect, vi, beforeEach } from "vitest";
const session = vi.hoisted(() => ({
  value: null as null | { user: { id: string; role: string } },
}));
vi.mock("@/lib/auth", () => ({ getSession: async () => session.value }));
import {
  requireUser,
  requireAdmin,
  assertOrigin,
  input,
  endpoint,
  ApiError,
} from "@/lib/security";
import { z } from "zod";
beforeEach(() => {
  session.value = null;
  process.env.NEXT_PUBLIC_APP_URL = "https://painradar.example";
});
describe("auth, RBAC and API boundaries", () => {
  it("requires authenticated users", async () =>
    expect(requireUser()).rejects.toMatchObject({ status: 401 }));
  it("rejects ordinary users from admin operations", async () => {
    session.value = { user: { id: "test", role: "user" } };
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });
  it("accepts admin only after session verification", async () => {
    session.value = { user: { id: "admin-test", role: "admin" } };
    expect((await requireAdmin()).id).toBe("admin-test");
  });
  it("rejects cross-origin mutations", () =>
    expect(() =>
      assertOrigin(
        new Request("https://painradar.example/api/radars", {
          method: "POST",
          headers: { origin: "https://attacker.example" },
        }),
      ),
    ).toThrow(ApiError));
  it("requires an Origin header for browser mutations", () =>
    expect(() =>
      assertOrigin(
        new Request("https://painradar.example/api/radars", { method: "POST" }),
      ),
    ).toThrow(ApiError));
  it("accepts configured same origin", () =>
    expect(() =>
      assertOrigin(
        new Request("https://painradar.example/api/radars", {
          method: "POST",
          headers: { origin: "https://painradar.example" },
        }),
      ),
    ).not.toThrow());
  it("rejects malformed input with 400", async () =>
    expect(
      input(
        new Request("https://painradar.example", { method: "POST", body: "{" }),
        z.object({ name: z.string() }),
      ),
    ).rejects.toMatchObject({ status: 400 }));
  it("validates fields before invoking mutations", async () =>
    expect(
      input(
        new Request("https://painradar.example", {
          method: "POST",
          body: '{"name":4}',
        }),
        z.object({ name: z.string() }),
      ),
    ).rejects.toMatchObject({ status: 400 }));
  it("returns readable API authorization failures", async () => {
    const response = await endpoint(async () => {
      await requireUser();
      return Response.json({ ok: true });
    })(
      new Request("https://painradar.example/api/watchlist", {
        method: "POST",
        headers: { origin: "https://painradar.example" },
      }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Log in to continue." });
  });
});

const maintenanceRequest = (
  body: string,
  origin = "https://painradar.example",
) =>
  new Request("https://painradar.example/api/admin/maintenance", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body,
  });
describe("maintenance admin endpoint boundaries", () => {
  it("rejects guests and ordinary users before cleanup", async () => {
    expect((await maintenancePost(maintenanceRequest("{}"))).status).toBe(401);
    session.value = { user: { id: "fixture", role: "user" } };
    expect((await maintenancePost(maintenanceRequest("{}"))).status).toBe(403);
  });
  it("rejects cross-origin cleanup even for an admin", async () => {
    session.value = { user: { id: "fixture", role: "admin" } };
    expect(
      (
        await maintenancePost(
          maintenanceRequest("{}", "https://attacker.example"),
        )
      ).status,
    ).toBe(403);
  });
  it("rejects invalid preview flags and arbitrary cleanup policy input", async () => {
    session.value = { user: { id: "fixture", role: "admin" } };
    expect(
      (await maintenancePost(maintenanceRequest('{"preview":"false"}'))).status,
    ).toBe(400);
    expect(
      (
        await maintenancePost(
          maintenanceRequest('{"preview":false,"signalDays":0}'),
        )
      ).status,
    ).toBe(400);
  });
});

describe("radar editing endpoint boundaries", () => {
  const request = (body: unknown, origin = "https://painradar.example") =>
    new Request("https://painradar.example/api/radars", {
      method: "PATCH",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  it("rejects guests and cross-origin edits", async () => {
    expect((await radarPatch(request({}))).status).toBe(401);
    session.value = { user: { id: "fixture", role: "user" } };
    expect(
      (await radarPatch(request({}, "https://attacker.example"))).status,
    ).toBe(403);
  });
  it("rejects invalid filters and caller-supplied ownership", async () => {
    session.value = { user: { id: "fixture", role: "user" } };
    const valid = {
      id: "a0000000-0000-4000-8000-000000000001",
      name: "Radar",
      keywords: ["builds"],
      excludedWords: [],
      industries: [],
      sources: ["hn"],
      languages: ["en"],
      alertThreshold: 60,
      frequency: "daily",
    };
    for (const body of [
      { ...valid, userId: "other" },
      { ...valid, keywords: [] },
      { ...valid, sources: [] },
      { ...valid, languages: [] },
      { ...valid, alertThreshold: 101 },
    ])
      expect((await radarPatch(request(body))).status).toBe(400);
  });
});
