import {
  billingOrigin,
  checkoutPrice,
  assertNewSubscriptionAllowed,
} from "@/lib/billing-config";
import { billingRedirectUrl } from "@/lib/billing-redirect";
import { z } from "zod";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { ensureBillingCustomer } from "@/lib/billing-reconciliation";
import {
  endpoint,
  requireUser,
  rateLimit,
  input,
  ApiError,
  audit,
} from "@/lib/security";
export const POST = endpoint(async (req) => {
  const user = await requireUser();
  await rateLimit(user.id);
  const { plan } = await input(
    req,
    z.object({ plan: z.enum(["pro", "founder", "agency"]) }).strict(),
  );
  const origin = billingOrigin();
  const price = checkoutPrice(plan);
  const sub = (
    await db()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
  )[0];
  assertNewSubscriptionAllowed(sub);
  const customerId = await ensureBillingCustomer(user.id);
  const s = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: user.id,
    metadata: { userId: user.id, plan },
    subscription_data: { metadata: { userId: user.id, plan } },
    success_url: origin + "/app/settings?billing=success",
    cancel_url: origin + "/pricing",
  });
  const url = billingRedirectUrl(s.url);
  if (!url)
    throw new ApiError(
      502,
      "Checkout could not be opened. Please try again shortly.",
    );
  await audit(user.id, "billing.checkout", { plan });
  return Response.json({ url });
});
