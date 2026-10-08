import { describe, it, expect, vi, afterEach } from "vitest";
import { adapters } from "@/lib/sources";
import { collectWindow, collectionWindow } from "@/lib/sources/collection";
import type { CollectionState, SourceAdapter } from "@/lib/sources/types";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const mockResponse = (data: unknown) => ({ ok: true, json: async () => data });
const now = new Date("2026-10-05T12:00:00Z");
describe("Provider pagination and resumable collection", () => {
  it("requests HN page numbers and advances to the next keyword only after exhaustion", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse({ hits: [], nbPages: 2, nbHits: 150 }),
      )
      .mockResolvedValueOnce(
        mockResponse({ hits: [], nbPages: 2, nbHits: 150 }),
      );
    vi.stubGlobal("fetch", fetch);
    const config = {
      keywords: ["pain", "slow"],
      since: "2026-10-01T00:00:00Z",
      until: now.toISOString(),
    };
    const first = await adapters.hn.fetchPage(config);
    expect(first.nextCursor).toEqual({ scope: 0, page: 1 });
    const second = await adapters.hn.fetchPage(config, first.nextCursor!);
    expect(second.nextCursor).toEqual({ scope: 1, page: 0 });
    const u = new URL(fetch.mock.calls[1][0]);
    expect(u.searchParams.get("page")).toBe("1");
    expect(u.searchParams.get("numericFilters")).toContain("created_at_i<=");
  });
  it("reports capped HN search windows instead of marking them complete", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          mockResponse({ hits: [], nbPages: 10, nbHits: 5000 }),
        ),
    );
    const page = await adapters.hn.fetchPage(
      { keywords: ["pain"] },
      { scope: 0, page: 9 },
    );
    expect(page.warning).toContain("exceeds");
  });
  it("uses GitHub updated ordering, follows full pages and filters PRs", async () => {
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      created_at: "2026-10-02T00:00:00Z",
      updated_at: "2026-10-03T00:00:00Z",
      ...(i === 0 ? { pull_request: {} } : {}),
    }));
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ private: false }))
      .mockResolvedValueOnce(mockResponse(items));
    vi.stubGlobal("fetch", fetch);
    const page = await adapters.github.fetchPage({
      repositories: ["test/fixture"],
      until: now.toISOString(),
    });
    expect(page.records).toHaveLength(99);
    expect(page.nextCursor).toEqual({ scope: 0, page: 2 });
    expect(new URL(fetch.mock.calls[1][0]).searchParams.get("sort")).toBe(
      "updated",
    );
  });
  it("stops GitHub at the frozen window end without including later updates", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(mockResponse({ private: false }))
        .mockResolvedValueOnce(
          mockResponse([
            {
              created_at: "2026-10-02T00:00:00Z",
              updated_at: "2026-10-06T00:00:00Z",
            },
          ]),
        ),
    );
    const page = await adapters.github.fetchPage({
      repositories: ["test/fixture"],
      until: now.toISOString(),
    });
    expect(page.records).toHaveLength(0);
    expect(page.nextCursor).toBeNull();
  });
  it("continues Reddit using the returned after token and stops at older posts", async () => {
    vi.stubEnv("REDDIT_CLIENT_ID", "test-only");
    vi.stubEnv("REDDIT_CLIENT_SECRET", "test-only");
    const post = {
      author: "fixture",
      selftext: "Test fixture evidence",
      created_utc: Date.parse("2026-10-03T00:00:00Z") / 1000,
    };
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ access_token: "fixture-token" }))
      .mockResolvedValueOnce(
        mockResponse({
          data: { children: [{ data: post }], after: "t3_fixture" },
        }),
      )
      .mockResolvedValueOnce(mockResponse({ access_token: "fixture-token" }))
      .mockResolvedValueOnce(
        mockResponse({
          data: {
            children: [{ data: { ...post, created_utc: 1 } }],
            after: "t3_older",
          },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const config = {
      subreddits: ["testfixture"],
      since: "2026-10-01T00:00:00Z",
      until: now.toISOString(),
    };
    const first = await adapters.reddit.fetchPage(config);
    expect(first.nextCursor?.after).toBe("t3_fixture");
    const second = await adapters.reddit.fetchPage(config, first.nextCursor!);
    expect(new URL(fetch.mock.calls[3][0]).searchParams.get("after")).toBe(
      "t3_fixture",
    );
    expect(second.nextCursor).toBeNull();
    expect(second.records).toHaveLength(0);
  });
  it("preserves a frozen window and resumes the next page after budget exhaustion", async () => {
    const adapter: SourceAdapter<number> = {
      id: "hn",
      healthCheck: async () => ({ ok: true, message: "" }),
      normalizeSignal: () => null,
      fetchSignals: async () => [],
      fetchPage: vi.fn(async (_config, c) => ({
        records: [c!.page],
        nextCursor: c!.page === 2 ? null : { scope: 0, page: c!.page + 1 },
      })),
    };
    const config = { pageBudget: 1, keywords: ["fixture"] };
    const state = collectionWindow(adapter, config, null, null, now);
    let saved: CollectionState = state;
    let done = false;
    const checkpoint = async (
      _page: unknown,
      s: CollectionState,
      complete: boolean,
    ) => {
      saved = s;
      done = complete;
      return true;
    };
    await collectWindow(adapter, config, state, checkpoint);
    expect(saved.cursor.page).toBe(1);
    expect(done).toBe(false);
    const resumed = collectionWindow(
      adapter,
      config,
      saved,
      null,
      new Date(now.getTime() + 86400000),
    );
    expect(resumed.until).toBe(now.toISOString());
    await collectWindow(
      adapter,
      { ...config, pageBudget: 2 },
      resumed,
      checkpoint,
    );
    expect(done).toBe(true);
    expect(saved.pages).toBe(3);
  });
  it("does not acknowledge a provider page when persistence fails", async () => {
    const adapter = {
      ...adapters.hn,
      fetchPage: vi.fn(async () => ({
        records: [],
        nextCursor: { scope: 0, page: 1 },
      })),
    };
    const state = collectionWindow(adapter, {}, null, null, now);
    await expect(
      collectWindow(adapter, {}, state, async () => {
        throw new Error("Database unavailable");
      }),
    ).rejects.toThrow("Database unavailable");
    expect(state.cursor.page).toBe(0);
  });
  it("retains the incomplete cursor and watermark when provider coverage is partial", async () => {
    const adapter = {
      ...adapters.hn,
      fetchPage: vi.fn(async () => ({
        records: [],
        nextCursor: null,
        warning: "Capped",
      })),
    };
    const state = collectionWindow(adapter, {}, null, null, now);
    let saved: CollectionState | undefined;
    const r = await collectWindow(
      adapter,
      {},
      state,
      async (_p, s, complete) => {
        saved = s;
        expect(complete).toBe(false);
        return true;
      },
    );
    expect(r.complete).toBe(false);
    expect(saved?.cursor).toEqual(state.cursor);
  });
  it("stops a stale worker when source configuration changes during collection", async () => {
    const fetchPage = vi.fn(async () => ({
      records: [],
      nextCursor: { scope: 0, page: 1 },
    }));
    const adapter = { ...adapters.hn, fetchPage };
    const state = collectionWindow(adapter, {}, null, null, now);
    const r = await collectWindow(adapter, {}, state, async () => false);
    expect(r.configurationChanged).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

it("rejects private GitHub repositories before requesting their issues", async () => {
  const fetch = vi.fn().mockResolvedValue(mockResponse({ private: true }));
  vi.stubGlobal("fetch", fetch);
  await expect(
    adapters.github.fetchPage({ repositories: ["test/private-fixture"] }),
  ).rejects.toThrow("Only public");
  expect(fetch).toHaveBeenCalledTimes(1);
});
