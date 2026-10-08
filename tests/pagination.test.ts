import { describe, it, expect, vi, afterEach } from "vitest";
import {
  encodePageCursor,
  decodePageCursor,
  pageScope,
  apiQuerySchema,
} from "@/lib/api-pagination";
afterEach(() => vi.unstubAllEnvs());
const id = "a0000000-0000-4000-8000-000000000001";
const now = Date.parse("2026-10-05T12:00:00Z");
describe("Signed, query-bound API pagination", () => {
  it("round trips a cursor and rejects tampering", () => {
    vi.stubEnv(
      "BETTER_AUTH_SECRET",
      "test-only-secret-longer-than-thirty-two-characters",
    );
    const scope = pageScope("fixture-key", { q: "pain" });
    const token = encodePageCursor({ id, score: 70.5 }, scope, now);
    expect(decodePageCursor(token, scope, now)).toEqual({ id, score: 70.5 });
    const [body, sig] = token.split(".");
    expect(() =>
      decodePageCursor(
        body + "." + (sig[0] === "A" ? "B" : "A") + sig.slice(1),
        scope,
        now,
      ),
    ).toThrow("invalid");
  });
  it("binds cursors to the API key and filters and rejects expired cursors", () => {
    vi.stubEnv(
      "BETTER_AUTH_SECRET",
      "test-only-secret-longer-than-thirty-two-characters",
    );
    const scope = pageScope("key-a", { q: "pain" });
    const token = encodePageCursor({ id, score: 70.5 }, scope, now);
    expect(() =>
      decodePageCursor(token, pageScope("key-b", { q: "pain" }), now),
    ).toThrow();
    expect(() =>
      decodePageCursor(token, pageScope("key-a", { q: "other" }), now),
    ).toThrow();
    expect(() => decodePageCursor(token, scope, now + 900000)).toThrow(
      "expired",
    );
  });
  it("validates filter ranges, bounded limits and unknown query parameters", () => {
    expect(apiQuerySchema.parse({ limit: "100", score: "0" }).score).toBe(0);
    for (const query of [
      { limit: "101" },
      { limit: "0" },
      { score: "101" },
      { cursor: "x".repeat(1001) },
      { unknown: "x" },
    ])
      expect(apiQuerySchema.safeParse(query).success).toBe(false);
  });
});
