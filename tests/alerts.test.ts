import { it, expect } from "vitest";
import { matchesRadar } from "@/lib/alerts";
it("matches keyword interest and enforces exclusion and industry", () => {
  const opportunity = {
    title: "Slow deployment feedback",
    summary: "Builders wait for errors",
    industry: "Developer tools",
  };
  expect(
    matchesRadar(opportunity, {
      keywords: ["deployment"],
      excludedWords: [],
      industries: [],
    }),
  ).toBe(true);
  expect(
    matchesRadar(opportunity, {
      keywords: ["deployment"],
      excludedWords: ["slow"],
      industries: [],
    }),
  ).toBe(false);
  expect(
    matchesRadar(opportunity, {
      keywords: ["deployment"],
      excludedWords: [],
      industries: ["Healthcare"],
    }),
  ).toBe(false);
});
