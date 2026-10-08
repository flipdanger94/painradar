import { requireWorkspace } from "@/lib/tenancy";
import { z } from "zod";
import {
  endpoint,
  requireUser,
  userPlan,
  rateLimit,
  input,
  ApiError,
  audit,
} from "@/lib/security";
import { generateMvp } from "@/lib/mvp";
export const POST = endpoint(async (req) => {
  const user = await requireUser();
  await rateLimit("mvp:" + user.id);
  const { id, workspaceId } = await input(
    req,
    z.object({ id: z.uuid(), workspaceId: z.uuid().optional() }),
  );
  if (workspaceId) await requireWorkspace(workspaceId, user.id, "edit");
  const plan = workspaceId ? "agency" : await userPlan(user.id);
  if (!["founder", "agency"].includes(plan))
    throw new ApiError(403, "Founder plan required for MVP generation.");
  const result = await generateMvp(id, user.id);
  await audit(user.id, "mvp.generated", { opportunityId: id });
  return Response.json(result);
});
