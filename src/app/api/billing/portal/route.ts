import { billingOrigin } from "@/lib/billing-config";
import { billingRedirectUrl } from "@/lib/billing-redirect";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { stripe } from "@/lib/stripe";
import { endpoint, requireUser, rateLimit, ApiError } from "@/lib/security";
export const POST = endpoint(async () => {
  const user = await requireUser();
  await rateLimit(user.id);
  const origin = billingOrigin();
  const sub = (
    await db()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
  )[0];
  if (!sub?.customerId)
    throw new ApiError(404, "No billing account yet. Choose a plan first.");
  const portal = await stripe().billingPortal.sessions.create({
    customer: sub.customerId,
    return_url: origin + "/app/settings",
  });
  const url = billingRedirectUrl(portal.url);
  if (!url)
    throw new ApiError(
      502,
      "Billing portal could not be opened. Please try again shortly.",
    );
  return Response.json({ url });
});
