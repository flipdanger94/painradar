import { z } from "zod";

export const solutionFitSchema = z.object({
  coverage: z.enum(["full", "partial", "unmet", "unknown"]),
  rationale: z.string().min(1).max(1200),
  sourceUrls: z.array(z.string()).max(10),
  evidenceIds: z.array(z.string()).max(15),
});

// A transparent rubric over cited AI comparisons, never a verified market census.
export function marketGap(results: Record<string, unknown>[]) {
  const domains = new Map<string, number | null>();
  for (const result of results) {
    let domain: string;
    try {
      const url = new URL(String(result.url));
      if (!["http:", "https:"].includes(url.protocol)) continue;
      domain = url.hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      continue;
    }
    const fit = solutionFitSchema.safeParse(result.solutionFit);
    const gap =
      fit.success &&
      fit.data.coverage !== "unknown" &&
      fit.data.sourceUrls.length &&
      fit.data.evidenceIds.length
        ? { full: 0, partial: 50, unmet: 100 }[fit.data.coverage]
        : null;
    const previous = domains.get(domain);
    // Multiple product pages do not increase the weight of one provider.
    domains.set(
      domain,
      previous == null ? gap : gap == null ? previous : Math.min(previous, gap),
    );
  }
  const assessed = [...domains.values()].filter((v): v is number => v !== null);
  return {
    score:
      assessed.length >= 2
        ? Math.round(assessed.reduce((sum, v) => sum + v, 0) / assessed.length)
        : null,
    assessed: assessed.length,
    unknown: domains.size - assessed.length,
    providers: domains.size,
  };
}
