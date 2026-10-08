import { requireWorkspace } from "@/lib/tenancy";
import { z } from "zod";
import {
  endpoint,
  requireUser,
  userPlan,
  input,
  rateLimit,
  ApiError,
  audit,
} from "@/lib/security";
import { researchCompetitors } from "@/lib/research";
export const maxDuration = 180;
export const POST = endpoint(async (req) => {
  const u = await requireUser();
  await rateLimit("research:" + u.id);
  const { id, workspaceId } = await input(
    req,
    z.object({ id: z.uuid(), workspaceId: z.uuid().optional() }),
  );
  if (workspaceId) await requireWorkspace(workspaceId, u.id, "edit");
  if (
    !["founder", "agency"].includes(
      workspaceId ? "agency" : await userPlan(u.id),
    )
  )
    throw new ApiError(403, "Founder plan required for competitor research");
  const result = await researchCompetitors(id);
  await audit(u.id, "competitors.researched", { opportunityId: id });
  return Response.json(result);
});
