import { describe, it, expect } from "vitest";
import { pipelineError } from "@/lib/pipeline-errors";
import { locales, translate } from "@/lib/i18n/messages";
describe("safe processing errors", () => {
  it.each([
    "Gemini quota exceeded. provider-private-body",
    "Gemini is not configured: add GEMINI_API_KEY",
    "Gemini request failed (HTTP 401). private-key",
    "Gemini request failed (HTTP 403). private-key",
    "Gemini request failed (HTTP 404). private-model",
    "Gemini request failed (HTTP 503). private-body",
  ])("classifies %s without exposing raw error data", (message) => {
    const result = pipelineError(message);
    expect(result).not.toContain("private");
    expect(result).not.toContain("GEMINI_API_KEY");
    expect(pipelineError(result)).toBe(result);
    for (const locale of locales.filter((l) => l !== "en"))
      expect(translate(locale, result)).not.toBe(result);
  });
  it("does not disclose arbitrary provider responses", () => {
    expect(
      pipelineError("token=private-secret https://private.test/path"),
    ).toBe("Processing failed. Review the job in Inngest before restarting.");
  });
});
