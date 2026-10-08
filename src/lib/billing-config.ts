import { ApiError } from "./security";
export function billingOrigin() {
  if (!process.env.STRIPE_SECRET_KEY?.trim())
    throw new ApiError(503, "Billing has not been configured yet.");
  let url: URL;
  try {
    url = new URL(process.env.NEXT_PUBLIC_APP_URL || "");
  } catch {
    throw new ApiError(
      503,
      "Billing return address has not been configured correctly.",
    );
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const allowedProtocol =
    url.protocol === "https:" ||
    (url.protocol === "http:" &&
      local &&
      process.env.NODE_ENV !== "production");
  if (
    !allowedProtocol ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new ApiError(
      503,
      "Billing return address has not been configured correctly.",
    );
  return url.origin;
}
export function checkoutPrice(plan: "pro" | "founder" | "agency") {
  const price = process.env["STRIPE_PRICE_" + plan.toUpperCase()];
  if (!price || !/^price_[A-Za-z0-9]+$/.test(price))
    throw new ApiError(503, "This plan is not available for checkout yet.");
  return price;
}
export function assertNewSubscriptionAllowed(
  sub: { subscriptionId?: string | null; status: string } | undefined,
) {
  if (!sub) return;
  if (sub.status === "incomplete" && sub.subscriptionId)
    throw new ApiError(
      409,
      "A subscription is already in progress. Finish your existing checkout or contact support before starting another.",
    );
  if (
    ["active", "trialing"].includes(sub.status) ||
    (sub.subscriptionId &&
      !["canceled", "incomplete_expired"].includes(sub.status))
  )
    throw new ApiError(
      409,
      "Manage your existing subscription in the billing portal or contact support before starting another.",
    );
}
