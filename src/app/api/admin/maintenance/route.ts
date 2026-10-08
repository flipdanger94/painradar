import { z } from "zod";
import {
  endpoint,
  requireAdmin,
  rateLimit,
  input,
  audit,
  ApiError,
} from "@/lib/security";
import { runMaintenance } from "@/lib/maintenance";
export const POST = endpoint(async (req) => {
  const user = await requireAdmin();
  await rateLimit("maintenance:" + user.id);
  const { preview } = await input(
    req,
    z.object({ preview: z.boolean().default(true) }).strict(),
  );
  const id = crypto.randomUUID();
  const result = await runMaintenance(id, preview);
  if (result.busy)
    throw new ApiError(
      409,
      "Maintenance is already running; try again shortly",
    );
  await audit(
    user.id,
    preview ? "maintenance.previewed" : "maintenance.completed",
    { runId: id },
  );
  return Response.json({ ok: true, result });
});
export const maxDuration = 60;
