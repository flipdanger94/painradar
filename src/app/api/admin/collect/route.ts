import { endpoint, requireAdmin, rateLimit, audit } from "@/lib/security";
import { inngest } from "@/lib/jobs";
export const POST = endpoint(async () => {
  const u = await requireAdmin();
  await rateLimit("collect:" + u.id);
  const event = await inngest.send({
    name: "painradar/collect.requested",
    data: { requestedBy: u.id },
  });
  await audit(u.id, "pipeline.triggered");
  return Response.json({ ok: true, ids: event.ids });
});
