import { describe, it, expect, vi, afterEach } from "vitest";
const mocked = vi.hoisted(() => ({ json: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/sources/public-fetch", () => ({
  publicJson: mocked.json,
  publicFetch: mocked.fetch,
}));
import { adapters } from "@/lib/sources";
import { parseFeed } from "@/lib/sources/extended";
import { csvSignals } from "@/lib/sources/csv";
import { sourceConfigInput } from "@/lib/sources/config";
import {
  collectWindow,
  collectionConfigHash,
  collectionWindow,
} from "@/lib/sources/collection";
const config = { since: "2026-10-01T00:00:00Z", until: "2026-10-08T23:00:00Z" };
afterEach(() => {
  vi.resetAllMocks();
});
describe("new public adapters", () => {
  it("keeps existing collection hashes stable and resets new scopes", () => {
    const old = { keywords: ["Ask HN"] };
    expect(collectionConfigHash(old)).toBe(
      "c6711b00868f11b236173a28e61d5bd581125cbad34f1c561a1e6224f0259dd7",
    );
    expect(
      collectionConfigHash({ tags: ["python"], site: "stackoverflow" }),
    ).not.toBe(collectionConfigHash({ tags: ["python"], site: "superuser" }));
  });
  it("rejects unsafe URLs and malformed scopes before requests", async () => {
    for (const id of ["rss", "discourse"] as const) {
      await expect(
        adapters[id].fetchPage(
          id === "rss"
            ? { feeds: ["https://127.0.0.1"] }
            : { forums: ["http://forum.example.org"] },
        ),
      ).rejects.toThrow();
    }
    expect(
      sourceConfigInput.safeParse({
        id: "gitlab",
        enabled: true,
        config: { projects: ["../secret"] },
      }).success,
    ).toBe(false);
    expect(
      sourceConfigInput.safeParse({ id: "csv", enabled: true, config: {} })
        .success,
    ).toBe(false);
    expect(
      sourceConfigInput.safeParse({
        id: "rss",
        enabled: true,
        config: { feeds: ["https://public.example.org/rss"] },
      }).success,
    ).toBe(true);
    expect(mocked.json).not.toHaveBeenCalled();
    expect(mocked.fetch).not.toHaveBeenCalled();
  });
  it("reads Stack Exchange bodies and keeps attribution, pagination and backoff", async () => {
    mocked.json.mockResolvedValue({
      data: {
        items: [
          {
            question_id: 17,
            link: "https://stackoverflow.com/questions/17",
            owner: {
              display_name: "Author",
              link: "https://stackoverflow.com/users/2",
            },
            title: "Deployment problem",
            body: "<p>Deployments keep failing without any useful explanation.</p>",
            creation_date: 1791158400,
            score: 2,
            answer_count: 1,
          },
        ],
        has_more: true,
        backoff: 120,
        quota_remaining: 100,
      },
    });
    const page = await adapters.stackexchange.fetchPage({
      ...config,
      site: "stackoverflow",
      tags: ["python"],
    });
    expect(page.records).toHaveLength(1);
    expect(page.records[0]).toMatchObject({
      source: "stackexchange",
      author: "Author",
      metadata: { license: "CC BY-SA" },
    });
    expect(page.nextCursor).toMatchObject({ scope: 0, page: 1 });
    expect(page.pauseUntil).toBeTruthy();
    const initial = collectionWindow(
      adapters.stackexchange,
      { ...config, tags: ["python"] },
      null,
      null,
      new Date(config.until),
    );
    const save = vi.fn(async (...args: unknown[]) => args.length === 3);
    await collectWindow(
      adapters.stackexchange,
      { ...config, tags: ["python"], pageBudget: 3 },
      initial,
      save,
    );
    expect(mocked.json).toHaveBeenCalledTimes(2);
    expect((save.mock.calls[0][1] as { cursor: unknown }).cursor).toMatchObject(
      {
        page: 1,
        retryAt: expect.any(String),
      },
    );
  });
  it("does not request Stack Exchange while backoff is active and finalizes a completed paused scope without refetching", async () => {
    await expect(
      adapters.stackexchange.fetchPage(
        { tags: ["python"] },
        {
          scope: 0,
          page: 1,
          retryAt: new Date(Date.now() + 60000).toISOString(),
        },
      ),
    ).rejects.toThrow("Source retry later");
    const p = await adapters.stackexchange.fetchPage(
      { tags: ["python"] },
      { scope: 0, page: 1, done: true },
    );
    expect(p.nextCursor).toBeNull();
    expect(mocked.json).not.toHaveBeenCalled();
  });
  it("verifies GitLab project visibility and excludes confidential issues", async () => {
    mocked.json.mockResolvedValueOnce({ data: { visibility: "private" } });
    await expect(
      adapters.gitlab.fetchPage({ projects: ["group/project"] }),
    ).rejects.toThrow("Only public");
    mocked.json
      .mockResolvedValueOnce({ data: { visibility: "public" } })
      .mockResolvedValueOnce({
        headers: { "x-next-page": "2" },
        data: [
          {
            iid: 3,
            web_url: "https://gitlab.com/group/project/-/issues/3",
            title: "Issue",
            description: "The integration keeps failing during every release.",
            created_at: "2026-10-03T12:00:00Z",
            confidential: false,
            author: { username: "author" },
          },
          { confidential: true },
        ],
      });
    const p = await adapters.gitlab.fetchPage({
      ...config,
      projects: ["group/project"],
    });
    expect(p.records).toHaveLength(1);
    expect(p.nextCursor).toEqual({ scope: 0, page: 1 });
  });
  it("paginates public Discourse posts by their oldest ID and filters removed posts", async () => {
    mocked.json.mockResolvedValue({
      data: {
        latest_posts: [
          {
            id: 30,
            topic_id: 5,
            post_number: 2,
            topic_title: "Broken integration",
            username: "author",
            cooked: "<p>My workflow fails every time I try to publish it.</p>",
            created_at: "2026-10-03T12:00:00Z",
          },
          { id: 29, hidden: true, created_at: "2026-10-03T12:00:00Z" },
        ],
      },
    });
    const p = await adapters.discourse.fetchPage({
      ...config,
      forums: ["https://forum.example.org/"],
    });
    expect(p.records).toHaveLength(1);
    expect(p.nextCursor).toMatchObject({ after: "29" });
    expect(p.records[0]).toMatchObject({
      source: "discourse",
      url: "https://forum.example.org/t/5/2",
    });
  });
  it("parses RSS and Atom, rejects entities, and skips entries without valid evidence or dates", () => {
    const rss = `<rss version="2.0"><channel><item><guid>1</guid><link>https://public.example.org/post</link><title>Issue</title><description><![CDATA[<p>My workflow is too slow and unreliable for production.</p>]]></description><pubDate>Sat, 03 Oct 2026 12:00:00 GMT</pubDate></item><item><title>No date</title></item></channel></rss>`;
    expect(parseFeed(rss, "https://public.example.org/rss")).toHaveLength(1);
    const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>tag:1</id><title>Issue</title><link href="/post"/><summary>My workflow is too slow and unreliable for production.</summary><updated>2026-10-03T12:00:00Z</updated><author><name>Author</name></author></entry></feed>`;
    expect(parseFeed(atom, "https://public.example.org/atom")[0]).toMatchObject(
      {
        source: "rss",
        author: "Author",
        url: "https://public.example.org/post",
      },
    );
    expect(() =>
      parseFeed(
        '<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>',
        "https://public.example.org/rss",
      ),
    ).toThrow();
  });
  it("validates CSV before ingestion, supports quoted multiline content and produces repeatable IDs", () => {
    const csv =
      'title,content,url,published_at,author\nProblem,"My workflow fails, often.\nIt is unusable in production.",https://public.example.org/post,2026-10-03T12:00:00Z,Author\n';
    const rows = csvSignals(csv);
    expect(rows[0]).toMatchObject({ source: "csv", author: "Author" });
    expect(csvSignals(csv)[0].externalId).toBe(rows[0].externalId);
    expect(() =>
      csvSignals(
        csv.replace(
          "https://public.example.org/post",
          "https://localhost/post",
        ),
      ),
    ).toThrow("invalid public HTTPS");
    expect(() =>
      csvSignals(csv.replace("2026-10-03T12:00:00Z", "not-a-date")),
    ).toThrow("invalid timestamp");
    expect(() => csvSignals(csv.replace("content,", "private,"))).toThrow(
      "CSV requires",
    );
  });
});
