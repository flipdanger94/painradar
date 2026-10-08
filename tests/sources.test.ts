import { describe, it, expect, vi, afterEach } from "vitest";
import { adapters } from "@/lib/sources";
import { signalSchema } from "@/lib/sources/types";
import { canonicalUrl, contentHash } from "@/lib/pipeline";
afterEach(() => vi.unstubAllGlobals());
describe("source normalization and ingestion contracts", () => {
  it("rejects invalid raw signals", () =>
    expect(signalSchema.safeParse({ url: "javascript:alert(1)" }).success).toBe(
      false,
    ));
  it("normalizes HN data with a real canonical source URL", () => {
    const s = adapters.hn.normalizeSignal({
      objectID: "123",
      title: "Ask HN: deployment frustration",
      story_text: "<p>My deployments fail without a useful error.</p>",
      author: "fixture-author",
      created_at: "2026-01-01T00:00:00Z",
      points: 5,
    });
    expect(s?.url).toBe("https://news.ycombinator.com/item?id=123");
    expect(s?.content).toBe("My deployments fail without a useful error.");
  });
  it("skips empty evidence", () =>
    expect(
      adapters.hn.normalizeSignal({
        objectID: "1",
        title: "Hi",
        author: "test",
        created_at: "2026-01-01",
      }),
    ).toBeNull());
  it("removes tracking and fragments without losing query IDs", () =>
    expect(
      canonicalUrl("https://example.com/post/?id=2&utm_source=x#reply"),
    ).toBe("https://example.com/post?id=2"));
  it("normalizes whitespace and case for exact dedup", () =>
    expect(contentHash({ title: " PAIN ", content: "Too   SLOW" })).toBe(
      contentHash({ title: "pain", content: "too slow" }),
    ));
  it("validates repository scope before making a network call", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      adapters.github.fetchSignals({ repositories: ["../../internal"] }),
    ).rejects.toThrow("Invalid GitHub");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("propagates provider failures without creating signals", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429 }),
    );
    await expect(
      adapters.hn.fetchSignals({ keywords: ["slow tooling"] }),
    ).rejects.toThrow("429");
  });
});
