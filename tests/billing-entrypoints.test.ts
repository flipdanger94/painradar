import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  user: { id: "u1", role: "user" } as { id: string; role: string } | null,
  sub: undefined as
    | undefined
    | {
        userId: string;
        customerId: string | null;
        subscriptionId: string | null;
        status: string;
      },
  checkout: vi.fn(),
  portal: vi.fn(),
  customer: vi.fn(),
  select: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getSession: async () => (state.user ? { user: state.user } : null),
}));
vi.mock("@/db", () => ({
  db: () => ({
    select: () => ({
      from: () => ({
        where: async (predicate: unknown) => {
          state.select(predicate);
          return state.sub ? [state.sub] : [];
        },
      }),
    }),
    insert: () => ({ values: state.audit }),
  }),
}));
vi.mock("@/lib/stripe", () => ({
  stripe: () => ({
    checkout: { sessions: { create: state.checkout } },
    billingPortal: { sessions: { create: state.portal } },
  }),
}));
vi.mock("@/lib/billing-reconciliation", () => ({
  ensureBillingCustomer: state.customer,
}));
import { POST as checkout } from "@/app/api/billing/checkout/route";
import { POST as portal } from "@/app/api/billing/portal/route";
import { billingOrigin } from "@/lib/billing-config";
import { billingRedirectUrl } from "@/lib/billing-redirect";
const request = (
  body: unknown = { plan: "pro" },
  origin = "https://painradar.example",
) =>
  new Request("https://painradar.example/api/billing/checkout", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://painradar.example/");
  vi.stubEnv("STRIPE_SECRET_KEY", "fixture-key");
  vi.stubEnv("STRIPE_PRICE_PRO", "price_fixturePro");
  vi.stubEnv("STRIPE_PRICE_FOUNDER", "price_fixtureFounder");
  vi.stubEnv("STRIPE_PRICE_AGENCY", "price_fixtureAgency");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  state.user = { id: "u1", role: "user" };
  state.sub = undefined;
  state.customer.mockResolvedValue("cus_1");
  state.checkout.mockResolvedValue({
    url: "https://checkout.stripe.com/c/pay/fixture",
  });
  state.portal.mockResolvedValue({
    url: "https://billing.stripe.com/p/session/fixture",
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("billing browser entrypoints", () => {
  it("rejects guests and cross-origin attempts before customer/provider calls", async () => {
    state.user = null;
    expect((await checkout(request())).status).toBe(401);
    expect((await portal(request())).status).toBe(401);
    state.user = { id: "u1", role: "user" };
    expect(
      (await checkout(request({ plan: "pro" }, "https://attacker.example")))
        .status,
    ).toBe(403);
    expect(state.select).not.toHaveBeenCalled();
    expect(state.customer).not.toHaveBeenCalled();
    expect(state.checkout).not.toHaveBeenCalled();
    expect(state.portal).not.toHaveBeenCalled();
  });
  it("checks missing keys/prices before creating a billing Customer", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const response = await checkout(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/not been configured/);
    expect((await portal(request())).status).toBe(503);
    vi.stubEnv("STRIPE_SECRET_KEY", "fixture-key");
    vi.stubEnv("STRIPE_PRICE_PRO", "");
    const missing = await checkout(request());
    expect(missing.status).toBe(503);
    expect((await missing.json()).error).toMatch(/plan is not available/);
    vi.stubEnv("STRIPE_PRICE_PRO", "prod_notAprice");
    expect((await checkout(request())).status).toBe(503);
    expect(state.customer).not.toHaveBeenCalled();
    expect(state.checkout).not.toHaveBeenCalled();
    expect(state.portal).not.toHaveBeenCalled();
  });
  it("rejects an invalid application URL with a readable configuration error", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "not a URL");
    const response = await checkout(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/address.*configured/);
    expect(state.customer).not.toHaveBeenCalled();
  });
  it.each([
    "http://painradar.example",
    "https://user:password@painradar.example",
    "https://painradar.example/base",
    "https://painradar.example/?secret=1",
    "https://painradar.example/#section",
  ])("rejects unsafe or non-root return address %s", async (url) => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", url);
    expect(
      (await checkout(request({ plan: "pro" }, new URL(url).origin))).status,
    ).toBe(503);
    expect((await portal(request({}, new URL(url).origin))).status).toBe(503);
    expect(state.customer).not.toHaveBeenCalled();
    expect(state.checkout).not.toHaveBeenCalled();
    expect(state.portal).not.toHaveBeenCalled();
  });
  it("uses only configured origin for all three plans and metadata belongs to the authenticated user", async () => {
    for (const plan of ["pro", "founder", "agency"]) {
      const response = await checkout(request({ plan }));
      expect(response.status).toBe(200);
      expect(state.customer).toHaveBeenLastCalledWith("u1");
      expect(state.checkout).toHaveBeenLastCalledWith(
        expect.objectContaining({
          customer: "cus_1",
          mode: "subscription",
          client_reference_id: "u1",
          metadata: { userId: "u1", plan },
          subscription_data: { metadata: { userId: "u1", plan } },
          success_url: "https://painradar.example/app/settings?billing=success",
          cancel_url: "https://painradar.example/pricing",
        }),
      );
      expect(state.audit).toHaveBeenLastCalledWith({
        userId: "u1",
        action: "billing.checkout",
        metadata: { plan },
      });
    }
  });
  it("rejects customer/user/price overrides and unsupported plans", async () => {
    for (const body of [
      { plan: "pro", customer: "cus_other" },
      { plan: "pro", userId: "other" },
      { plan: "pro", price: "price_other" },
      { plan: "free" },
    ])
      expect((await checkout(request(body))).status).toBe(400);
    expect(state.customer).not.toHaveBeenCalled();
    expect(state.checkout).not.toHaveBeenCalled();
  });
  it.each([
    "active",
    "trialing",
    "past_due",
    "unpaid",
    "paused",
    "incomplete",
    "unknown",
  ])(
    "does not create another subscription while known state is %s",
    async (status) => {
      state.sub = {
        userId: "u1",
        customerId: "cus_1",
        subscriptionId: "sub_1",
        status,
      };
      const response = await checkout(request());
      expect(response.status).toBe(409);
      expect((await response.json()).error).toMatch(
        status === "incomplete"
          ? /already in progress/
          : /existing subscription/,
      );
      expect(state.customer).not.toHaveBeenCalled();
      expect(state.checkout).not.toHaveBeenCalled();
    },
  );
  it.each(["canceled", "incomplete_expired"])(
    "allows a new checkout after terminal state %s",
    async (status) => {
      state.sub = {
        userId: "u1",
        customerId: "cus_1",
        subscriptionId: "sub_1",
        status,
      };
      expect((await checkout(request())).status).toBe(200);
    },
  );
  it("requires an existing Customer for the portal and does not require checkout prices", async () => {
    expect((await portal(request())).status).toBe(404);
    expect(state.portal).not.toHaveBeenCalled();
    state.sub = {
      userId: "u1",
      customerId: "cus_1",
      subscriptionId: "sub_1",
      status: "past_due",
    };
    vi.stubEnv("STRIPE_PRICE_PRO", "");
    const response = await portal(request());
    expect(response.status).toBe(200);
    expect(state.portal).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "https://painradar.example/app/settings",
    });
  });
  it("returns no redirect and no successful audit when provider URL is missing or unsafe", async () => {
    state.sub = {
      userId: "u1",
      customerId: "cus_1",
      subscriptionId: null,
      status: "inactive",
    };
    for (const url of [
      null,
      undefined,
      "javascript:alert(1)",
      "http://checkout.stripe.com/fixture",
      "https://secret@checkout.stripe.com/fixture",
    ]) {
      state.checkout.mockResolvedValueOnce({ url });
      state.portal.mockResolvedValueOnce({ url });
      expect((await checkout(request())).status).toBe(502);
      expect((await portal(request())).status).toBe(502);
    }
    expect(state.audit).not.toHaveBeenCalled();
  });
});
describe("billing URL helpers", () => {
  it("supports local development but refuses plain HTTP even locally in production", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000/");
    expect(billingOrigin()).toBe("http://localhost:3000");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => billingOrigin()).toThrow(/return address/);
  });
  it("accepts provider custom domains and rejects malformed redirect payloads", () => {
    expect(billingRedirectUrl("https://payments.example/session")).toBe(
      "https://payments.example/session",
    );
    for (const value of [
      null,
      {},
      4,
      "/checkout",
      "//checkout.stripe.com",
      "https://user:pass@payments.example/",
      "https://payments.example/" + "x".repeat(8192),
    ])
      expect(billingRedirectUrl(value)).toBeNull();
  });
});
