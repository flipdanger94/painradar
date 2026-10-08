import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = vi.hoisted(() => ({ verify: vi.fn(), execute: vi.fn() }));
vi.mock("@/db", () => ({ db: () => ({ execute: mock.execute }) }));
vi.mock("@/lib/stripe", () => ({
  stripe: () => ({ webhooks: { constructEvent: mock.verify } }),
}));
import { POST } from "@/app/api/billing/webhook/route";
beforeEach(() => {
  vi.resetAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "test-only-secret";
});
describe("Stripe webhook security", () => {
  it("rejects unsigned payloads", async () => {
    const r = await POST(
      new Request("https://test/api/billing/webhook", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(r.status).toBe(400);
    expect(mock.execute).not.toHaveBeenCalled();
  });
  it("rejects invalid signatures before database writes", async () => {
    mock.verify.mockImplementation(() => {
      throw new Error("invalid signature");
    });
    const r = await POST(
      new Request("https://test/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": "invalid" },
        body: "{}",
      }),
    );
    expect(r.status).toBe(400);
    expect(mock.execute).not.toHaveBeenCalled();
  });
  it("acknowledges harmless verified events", async () => {
    mock.verify.mockReturnValue({
      id: "test-event",
      type: "customer.created",
      data: { object: {} },
    });
    const r = await POST(
      new Request("https://test/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": "fixture" },
        body: "{}",
      }),
    );
    expect(r.status).toBe(200);
  });
});
