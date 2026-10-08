import { endpoint, requireUser } from "@/lib/security";
import { pipelineStatus } from "@/lib/pipeline-status";
export const GET = endpoint(async () => {
  await requireUser();
  return Response.json(await pipelineStatus(), {
    headers: { "Cache-Control": "private, no-store" },
  });
});
