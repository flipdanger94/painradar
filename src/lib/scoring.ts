export const weights = {
  frequency: 0.2,
  velocity: 0.2,
  willingnessToPay: 0.2,
  painIntensity: 0.15,
  competitionGap: 0.1,
  recency: 0.1,
  sourceDiversity: 0.05,
} as const;
export type ScoreComponents = Record<keyof typeof weights, number | null>;
const clamp = (n: number) => Math.min(100, Math.max(0, n));
export function opportunityScore(c: ScoreComponents) {
  return Math.round(
    Object.entries(weights).reduce(
      (total, [key, weight]) =>
        total + clamp(c[key as keyof ScoreComponents] ?? 0) * weight,
      0,
    ),
  );
}
export function growth(current: number, previous: number) {
  return previous === 0
    ? null
    : Math.round(((current - previous) / previous) * 1000) / 10;
}
export function confidence(
  authors: number,
  sources: number,
  fresh: number,
  samples: number,
) {
  if (authors >= 20 && sources >= 2 && fresh >= 0.6 && samples >= 30)
    return "High";
  if (authors >= 5 && fresh >= 0.3 && samples >= 8) return "Medium";
  return "Low";
}
export function trendStatus(
  g7: number | null,
  g30: number | null,
  ageDays: number,
) {
  if (ageDays < 7) return "New";
  if (g7 !== null && g7 >= 50) return "Surging";
  if ((g7 ?? g30 ?? 0) > 10) return "Growing";
  if ((g7 ?? g30 ?? 0) < -10) return "Declining";
  return "Stable";
}
export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || !a.length)
    throw new Error("Vector dimension mismatch");
  const dot = a.reduce((s, n, i) => s + n * b[i], 0);
  const na = Math.sqrt(a.reduce((s, n) => s + n * n, 0));
  const nb = Math.sqrt(b.reduce((s, n) => s + n * n, 0));
  return na && nb ? dot / (na * nb) : 0;
}
