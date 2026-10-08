import { freeTier } from "./gemini";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { competitorResearch } from "@/db/schema";
import { opportunity } from "./queries";
import { ApiError } from "./security";
import { solutionFitSchema } from "./market-gap";
const claim = z.object({ text: z.string(), sourceUrls: z.array(z.string()) });
const schema = z.object({
  competitors: z
    .array(
      z.object({
        name: z.string(),
        url: z.string(),
        description: claim,
        pricing: claim.nullable(),
        advantages: z.array(claim),
        complaints: z.array(claim),
        positioning: claim.nullable(),
        solutionFit: solutionFitSchema.nullable(),
      }),
    )
    .max(10),
});
export function validateResearch(
  value: z.infer<typeof schema>,
  sources: Set<string>,
  evidenceIds: Set<string> = new Set(),
) {
  value = schema.parse(value);
  const safeUrl = (s: string) => {
    try {
      const u = new URL(s);
      return ["https:", "http:"].includes(u.protocol);
    } catch {
      return false;
    }
  };
  for (const c of value.competitors) {
    if (!safeUrl(c.url) || !sources.has(c.url))
      throw new Error("Competitor URL is not in retrieved sources");
    for (const claim of [
      c.description,
      c.pricing,
      c.positioning,
      ...c.advantages,
      ...c.complaints,
    ])
      if (
        claim &&
        (!claim.sourceUrls.length ||
          claim.sourceUrls.some((u) => !safeUrl(u) || !sources.has(u)))
      )
        throw new Error("Competitor claim has unsupported citations");
    if (c.solutionFit) {
      const fit = solutionFitSchema.parse(c.solutionFit);
      if (
        fit.sourceUrls.some((u) => !safeUrl(u) || !sources.has(u)) ||
        fit.evidenceIds.some((id) => !evidenceIds.has(id)) ||
        (fit.coverage !== "unknown" &&
          (!fit.sourceUrls.length || !fit.evidenceIds.length))
      )
        throw new Error(
          "Solution fit has unsupported sources or signal evidence",
        );
    }
  }
  return value;
}
export async function researchCompetitors(id: string) {
  const o = await opportunity(id);
  if (!o) throw new ApiError(404, "Opportunity not found");
  const cached = (
    await db()
      .select()
      .from(competitorResearch)
      .where(eq(competitorResearch.opportunityId, id))
  )[0];
  if (
    cached &&
    cached.results.every((r) => Object.hasOwn(r, "solutionFit")) &&
    Date.now() - cached.researchedAt.getTime() < 7 * 86400000
  )
    return cached;
  if (!process.env.GEMINI_API_KEY)
    throw new ApiError(503, "AI research is not configured");
  if (freeTier())
    throw new ApiError(
      503,
      "Live competitor web research is unavailable on Gemini Free Tier. Evidence analysis and semantic search remain available.",
    );
  throw new ApiError(
    503,
    "Live competitor web research is not enabled for this Gemini configuration.",
  );
}
