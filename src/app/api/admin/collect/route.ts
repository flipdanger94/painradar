import {
  endpoint,
  requireAdmin,
  rateLimit,
  audit,
  ApiError,
} from "@/lib/security";
import { inngest } from "@/lib/jobs";
export const POST = endpoint(async () => {
  const u = await requireAdmin();
  await rateLimit("collect:" + u.id);
  if (!process.env.INNGEST_EVENT_KEY || !process.env.INNGEST_SIGNING_KEY)
    throw new ApiError(
      503,
      "Background collection is not configured. Connect Inngest and configure its event and signing keys before starting collection.",
    );
  const event = await inngest.send({
    name: "painradar/collect.requested",
    data: { requestedBy: u.id },
  });
  await audit(u.id, "pipeline.triggered");
  return Response.json({ ok: true, ids: event.ids });
});
