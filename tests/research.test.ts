import { it, expect } from "vitest";
import { validateResearch } from "@/lib/research";
it("rejects fabricated competitor URLs and unsupported factual citations", () => {
  const item = {
    name: "Fixture",
    url: "https://example.test",
    description: {
      text: "Test-only description",
      sourceUrls: ["https://example.test"],
    },
    pricing: null,
    advantages: [],
    complaints: [],
    positioning: null,
    solutionFit: null,
  };
  expect(() => validateResearch({ competitors: [item] }, new Set())).toThrow();
  expect(
    validateResearch(
      { competitors: [item] },
      new Set(["https://example.test"]),
    ),
  ).toEqual({ competitors: [item] });
  expect(() =>
    validateResearch(
      {
        competitors: [
          {
            ...item,
            pricing: {
              text: "Invented price",
              sourceUrls: ["https://invented.test"],
            },
          },
        ],
      },
      new Set(["https://example.test"]),
    ),
  ).toThrow();
});
