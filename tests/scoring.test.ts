import { describe, it, expect } from "vitest";
import {
  weights,
  opportunityScore,
  growth,
  confidence,
  trendStatus,
  cosineSimilarity,
} from "@/lib/scoring";
describe("evidence scoring", () => {
  it("weights total 100%", () =>
    expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBe(1));
  it("never upgrades unknown evidence to a positive score", () => {
    expect(
      opportunityScore({
        frequency: null,
        velocity: null,
        willingnessToPay: null,
        painIntensity: null,
        competitionGap: null,
        recency: null,
        sourceDiversity: null,
      }),
    ).toBe(0);
  });
  it("uses conservative missing competition input", () => {
    expect(
      opportunityScore({
        frequency: 100,
        velocity: 100,
        willingnessToPay: 100,
        painIntensity: 100,
        competitionGap: null,
        recency: 100,
        sourceDiversity: 100,
      }),
    ).toBe(90);
  });
  it("clamps noisy components", () =>
    expect(
      opportunityScore({
        frequency: 200,
        velocity: -20,
        willingnessToPay: null,
        painIntensity: null,
        competitionGap: null,
        recency: null,
        sourceDiversity: null,
      }),
    ).toBe(20));
  it("does not invent growth with no baseline", () => {
    expect(growth(100, 0)).toBeNull();
    expect(growth(15, 10)).toBe(50);
    expect(growth(5, 10)).toBe(-50);
  });
  it("requires source diversity for high confidence", () => {
    expect(confidence(40, 1, 1, 40)).toBe("Medium");
    expect(confidence(40, 3, 1, 40)).toBe("High");
    expect(confidence(3, 3, 1, 3)).toBe("Low");
  });
  it("classifies observed trends", () => {
    expect(trendStatus(90, 20, 15)).toBe("Surging");
    expect(trendStatus(-30, -20, 20)).toBe("Declining");
    expect(trendStatus(null, null, 2)).toBe("New");
  });
  it("handles vector similarity and invalid dimensions", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(() => cosineSimilarity([1], [1, 0])).toThrow();
  });
});
