import { describe, expect, it } from "vitest";
import { marketGap } from "@/lib/market-gap";
import { validateResearch } from "@/lib/research";

function competitor(
  url: string,
  coverage: "full" | "partial" | "unmet" | "unknown",
) {
  return {
    name: "Test fixture",
    url,
    description: { text: "Fixture capabilities", sourceUrls: [url] },
    pricing: null,
    positioning: null,
    advantages: [],
    complaints: [],
    solutionFit: {
      coverage,
      rationale: "Test comparison with a supplied pain signal",
      sourceUrls: [url],
      evidenceIds: ["signal-1"],
    },
  };
}

describe("cited pain comparisons", () => {
  it("requires both retrieved sources and supplied pain signals", () => {
    const item = competitor("https://one.test", "partial");
    const sources = new Set([item.url]);
    expect(
      validateResearch({ competitors: [item] }, sources, new Set(["signal-1"])),
    ).toEqual({ competitors: [item] });
    expect(() => validateResearch({ competitors: [item] }, sources)).toThrow(
      /signal evidence/,
    );
    item.solutionFit.sourceUrls = ["https://invented.test"];
    expect(() =>
      validateResearch({ competitors: [item] }, sources, new Set(["signal-1"])),
    ).toThrow(/unsupported/);
  });
  it("rejects known coverage with missing source or signal citations", () => {
    for (const field of ["sourceUrls", "evidenceIds"] as const) {
      const item = competitor("https://one.test", "unmet");
      item.solutionFit[field] = [];
      expect(() =>
        validateResearch(
          { competitors: [item] },
          new Set([item.url]),
          new Set(["signal-1"]),
        ),
      ).toThrow();
    }
  });
  it("allows insufficient evidence to remain unknown without citations", () => {
    const item = competitor("https://one.test", "unknown");
    item.solutionFit.sourceUrls = [];
    item.solutionFit.evidenceIds = [];
    expect(
      validateResearch({ competitors: [item] }, new Set([item.url])),
    ).toEqual({ competitors: [item] });
    expect(marketGap([item]).score).toBeNull();
  });
});

describe("sample gap rubric", () => {
  it("averages full/partial/unmet and excludes unknowns", () => {
    expect(
      marketGap([
        competitor("https://one.test", "full"),
        competitor("https://two.test", "partial"),
        competitor("https://three.test", "unmet"),
        competitor("https://four.test", "unknown"),
      ]),
    ).toEqual({ score: 50, assessed: 3, unknown: 1, providers: 4 });
  });
  it("does not treat no competitors, legacy research or one assessment as high gap", () => {
    expect(marketGap([]).score).toBeNull();
    expect(marketGap([{ url: "https://old.test" }])).toEqual({
      score: null,
      assessed: 0,
      unknown: 1,
      providers: 1,
    });
    expect(
      marketGap([competitor("https://one.test", "unmet")]).score,
    ).toBeNull();
  });
  it("groups www and multiple pages, using the best coverage for a provider", () => {
    const values = [
      competitor("https://one.test/product", "unmet"),
      competitor("https://www.one.test/other", "full"),
      competitor("https://two.test", "unmet"),
    ];
    expect(marketGap(values)).toEqual({
      score: 50,
      assessed: 2,
      unknown: 0,
      providers: 2,
    });
    expect(marketGap([...values].reverse())).toEqual(marketGap(values));
    expect(marketGap(values.slice(0, 2)).score).toBeNull();
  });
  it("treats malformed or uncited fits as unknown and skips invalid URLs", () => {
    const item = competitor("https://one.test", "unmet");
    item.solutionFit.evidenceIds = [];
    expect(
      marketGap([item, { url: "javascript:alert(1)" }, { url: "broken" }]),
    ).toEqual({ score: null, assessed: 0, unknown: 1, providers: 1 });
    expect(
      marketGap([{ url: item.url, solutionFit: { coverage: "made-up" } }])
        .score,
    ).toBeNull();
  });
  it("keeps covered and uncovered extremes within 0–100", () => {
    for (const [coverage, score] of [
      ["full", 0],
      ["unmet", 100],
    ] as const) {
      expect(
        marketGap([
          competitor("https://one.test", coverage),
          competitor("https://two.test", coverage),
        ]).score,
      ).toBe(score);
    }
  });
});
