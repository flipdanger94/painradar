import { afterEach, expect, it, vi } from "vitest";
import { geminiRequest, generatedText, normalizeEmbedding } from "@/lib/gemini";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("uses header authentication and never falls back to OpenAI on quota errors", async () => {
  vi.stubEnv("GEMINI_API_KEY", "test-only-gemini-key");
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response("private provider diagnostics", { status: 429 }),
    );
  vi.stubGlobal("fetch", fetchMock);
  await expect(
    geminiRequest("gemini-3.5-flash-lite", "generateContent", {}),
  ).rejects.toThrow("Gemini quota exceeded");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, request] = fetchMock.mock.calls[0];
  expect(url).not.toContain("test-only-gemini-key");
  expect(request.headers["x-goog-api-key"]).toBe("test-only-gemini-key");
});
it("rejects blocked or truncated output and excludes reasoning from JSON", () => {
  expect(() =>
    generatedText({
      candidates: [
        { finishReason: "MAX_TOKENS", content: { parts: [{ text: "{}" }] } },
      ],
    }),
  ).toThrow();
  expect(() => generatedText({})).toThrow();
  expect(
    generatedText({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              { thought: true, text: "reasoning" },
              { text: '{"ok":true}' },
            ],
          },
        },
      ],
    }),
  ).toBe('{"ok":true}');
});
it("validates vector dimensions and finite coordinates before pgvector storage", () => {
  expect(() => normalizeEmbedding([1, 2])).toThrow();
  expect(() => normalizeEmbedding(Array(1536).fill(0))).toThrow();
  expect(() => normalizeEmbedding(Array(1536).fill(NaN))).toThrow();
  expect(Math.hypot(...normalizeEmbedding(Array(1536).fill(0.1)))).toBeCloseTo(
    1,
  );
});
