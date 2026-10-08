import { afterEach, describe, expect, it, vi } from "vitest";
import { adapters } from "@/lib/sources";
import { sourceError } from "@/lib/sources/errors";
import { locales, translate } from "@/lib/i18n/messages";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Reddit diagnostics", () => {
  it("fails before any request if either credential is missing", async () => {
    vi.stubEnv("REDDIT_CLIENT_ID", "id");
    vi.stubEnv("REDDIT_CLIENT_SECRET", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      adapters.reddit.fetchPage({ subreddits: ["Vibecoding"] }),
    ).rejects.toThrow("Authorized Reddit API credentials required");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects a missing token instead of sending Bearer undefined", async () => {
    vi.stubEnv("REDDIT_CLIENT_ID", "id");
    vi.stubEnv("REDDIT_CLIENT_SECRET", "secret");
    const fetch = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ error: "invalid_client" }),
      });
    vi.stubGlobal("fetch", fetch);
    await expect(
      adapters.reddit.fetchPage({ subreddits: ["Vibecoding"] }),
    ).rejects.toThrow("Invalid Reddit token response");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("keeps known diagnostics translated and unknown provider details private", () => {
    for (const error of [
      "Authorized Reddit API credentials required",
      "Reddit authorization failed (HTTP 401)",
      "Invalid subreddit",
      "Source returned 403",
      "Source returned 404",
      "Invalid Reddit token response",
      "Source returned 429",
    ]) {
      const message = sourceError("reddit", error);
      for (const locale of locales.filter((l) => l !== "en"))
        expect(translate(locale, message)).not.toBe(message);
    }
    expect(sourceError("reddit", "private secret=123")).not.toContain("123");
  });
});
