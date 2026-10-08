import { invoiceEventTypes, synchronizeInvoice } from "@/lib/invoice-sync";
import Stripe from "stripe";
import { endpoint, ApiError } from "@/lib/security";
import { stripe } from "@/lib/stripe";
import { synchronizeSubscription } from "@/lib/billing-history";
export const POST = endpoint(
  async (req) => {
    if (!process.env.STRIPE_WEBHOOK_SECRET)
      throw new ApiError(503, "Webhook is not configured");
    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new ApiError(400, "Missing signature");
    let event: Stripe.Event;
    try {
      event = stripe().webhooks.constructEvent(
        await req.text(),
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      throw new ApiError(400, "Invalid signature");
    }
    if (event.type.startsWith("customer.subscription.")) {
      if (!(event.data.object as Stripe.Subscription).metadata?.userId)
        throw new ApiError(400, "Subscription user metadata is missing");
      await synchronizeSubscription(event);
    } else if (invoiceEventTypes.has(event.type)) {
      await synchronizeInvoice(event);
    }
    return Response.json({ received: true });
  },
  { origin: false },
);
