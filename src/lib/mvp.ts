import { z } from "zod";
import { analyze } from "./ai";
import { evidence, opportunity } from "./queries";
import { ApiError } from "./security";
import { db } from "@/db";
import { opportunities } from "@/db/schema";
import { eq } from "drizzle-orm";
const mvpSchema = z.object({
  problem: z.string(),
  icp: z.string(),
  solutionHypothesis: z.string(),
  functionality: z.array(z.string()),
  whatNotToBuild: z.array(z.string()),
  monetization: z.string(),
  pricingHypothesis: z.string(),
  firstCustomers: z.array(z.string()),
  risks: z.array(z.string()),
  evidenceIds: z.array(z.string()),
});
export async function generateMvp(id: string, userId: string) {
  const o = await opportunity(id);
  if (!o) throw new ApiError(404, "Opportunity not found");
  const signals = await evidence(o.clusterId);
  if (signals.length < 3) throw new ApiError(422, "Not enough evidence yet.");
  const result = await analyze(
    "mvp_proposal",
    {
      opportunity: { title: o.title, summary: o.summary },
      signals: signals.map((s) => ({
        id: s.id,
        source: s.source,
        url: s.url,
        title: s.title,
        content: s.content.slice(0, 3000),
      })),
      instruction:
        "All solution, pricing and acquisition recommendations are hypotheses, never market facts. Use only supplied evidence IDs.",
    },
    mvpSchema,
    "mvp:" + id,
    userId,
  );
  const ids = new Set(signals.map((s) => s.id));
  if (
    !result.evidenceIds.length ||
    result.evidenceIds.some((id) => !ids.has(id))
  )
    throw new Error("Unsupported MVP evidence IDs");
  await db()
    .update(opportunities)
    .set({ mvp: result })
    .where(eq(opportunities.id, o.id));
  return result;
}
