import {
  type SourceAdapter,
  type RawSignal,
  type SourceConfig,
  jsonFetch,
  cleanText,
  language,
  signalSchema,
  type SourceCursor,
  type SourcePage,
} from "./types";
type HN = {
  objectID: string;
  title?: string;
  story_title?: string;
  comment_text?: string;
  story_text?: string;
  author: string;
  created_at: string;
  points?: number;
  num_comments?: number;
};
function bounds(config: SourceConfig) {
  const since = new Date(config.since || Date.now() - 7 * 86400000).getTime();
  const until = new Date(config.until || Date.now()).getTime();
  if (!Number.isFinite(since) || !Number.isFinite(until) || since > until)
    throw new Error("Invalid collection time window");
  return { since, until };
}
function cursorValue(
  cursor: SourceCursor | undefined,
  startPage: number,
  scopeCount: number,
) {
  const c = cursor || { scope: 0, page: startPage };
  if (
    !Number.isInteger(c.scope) ||
    c.scope < 0 ||
    c.scope >= scopeCount ||
    !Number.isInteger(c.page) ||
    c.page < startPage ||
    c.page > 10000 ||
    (c.after && (!/^t3_[a-z0-9]+$/.test(c.after) || c.after.length > 100))
  )
    throw new Error("Invalid source cursor");
  return c;
}
function nextScope(
  scope: number,
  total: number,
  startPage: number,
): SourceCursor | null {
  return scope + 1 < total ? { scope: scope + 1, page: startPage } : null;
}
const hn: SourceAdapter<HN> = {
  id: "hn",
  async fetchSignals(config) {
    const scopes =
      this.id === "github"
        ? (config.repositories || []).slice(0, 20).length
        : this.id === "reddit"
          ? (config.subreddits || []).slice(0, 10).length
          : (config.keywords?.length ? config.keywords : ["Ask HN"]).slice(
              0,
              10,
            ).length;
    if (!scopes) return (await this.fetchPage(config)).records;
    const result = [];
    for (let scope = 0; scope < scopes; scope++)
      result.push(
        ...(
          await this.fetchPage(config, {
            scope,
            page: this.id === "github" ? 1 : 0,
          })
        ).records,
      );
    return result;
  },
  async fetchPage(config, cursor) {
    const keywords = (
      config.keywords?.length ? config.keywords : ["Ask HN"]
    ).slice(0, 10);
    const c = cursorValue(cursor, 0, keywords.length);
    const { since, until } = bounds(config);
    const q = new URLSearchParams({
      query: keywords[c.scope],
      tags: "(story,comment)",
      hitsPerPage: "100",
      page: String(c.page),
      numericFilters: `created_at_i>=${Math.floor(since / 1000)},created_at_i<=${Math.floor(until / 1000)}`,
    });
    const data = await jsonFetch(
      "https://hn.algolia.com/api/v1/search_by_date?" + q,
    );
    if (
      !Array.isArray(data.hits) ||
      !Number.isInteger(data.nbPages) ||
      data.nbPages < 0
    )
      throw new Error("Invalid HN page response");
    const more = c.page + 1 < data.nbPages;
    const truncated =
      !more && Number.isFinite(data.nbHits) && data.nbHits > data.nbPages * 100;
    return {
      records: data.hits,
      nextCursor: more
        ? { scope: c.scope, page: c.page + 1 }
        : nextScope(c.scope, keywords.length, 0),
      ...(truncated
        ? {
            warning:
              "HN search window exceeds provider accessible pages. Narrow the backfill start date or keyword scope.",
          }
        : {}),
    };
  },
  normalizeSignal(s) {
    const content = cleanText(s.comment_text || s.story_text || s.title || "");
    if (content.length < 20) return null;
    return signalSchema.parse({
      source: "hn",
      externalId: s.objectID,
      url: "https://news.ycombinator.com/item?id=" + s.objectID,
      author: s.author,
      title: s.title || s.story_title || "Hacker News comment",
      content: content.slice(0, 30000),
      publishedAt: s.created_at,
      discoveredAt: new Date(),
      language: language(content),
      engagement: Math.max(0, (s.points || 0) + (s.num_comments || 0)),
      metadata: {},
    });
  },
  async healthCheck() {
    try {
      await jsonFetch(
        "https://hn.algolia.com/api/v1/search?query=Ask%20HN&hitsPerPage=1",
      );
      return { ok: true, message: "Hacker News API available" };
    } catch {
      return { ok: false, message: "Hacker News API unavailable" };
    }
  },
};
type Issue = {
  id: number;
  html_url: string;
  user: { login: string };
  title: string;
  body: string | null;
  created_at: string;
  updated_at?: string;
  comments: number;
  pull_request?: unknown;
  labels: { name: string }[];
};
const github: SourceAdapter<Issue> = {
  id: "github",
  async fetchSignals(config) {
    const scopes =
      this.id === "github"
        ? (config.repositories || []).slice(0, 20).length
        : this.id === "reddit"
          ? (config.subreddits || []).slice(0, 10).length
          : (config.keywords?.length ? config.keywords : ["Ask HN"]).slice(
              0,
              10,
            ).length;
    if (!scopes) return (await this.fetchPage(config)).records;
    const result = [];
    for (let scope = 0; scope < scopes; scope++)
      result.push(
        ...(
          await this.fetchPage(config, {
            scope,
            page: this.id === "github" ? 1 : 0,
          })
        ).records,
      );
    return result;
  },
  async fetchPage(config, cursor) {
    const repositories = config.repositories?.slice(0, 20);
    if (!repositories?.length)
      throw new Error("Configure GitHub repositories before collecting");
    for (const repo of repositories)
      if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo))
        throw new Error("Invalid GitHub repository");
    const c = cursorValue(cursor, 1, repositories.length);
    const { since, until } = bounds(config);
    const q = new URLSearchParams({
      state: "all",
      sort: "updated",
      direction: "asc",
      per_page: "100",
      page: String(c.page),
      since: new Date(since).toISOString(),
    });
    const visibility = await jsonFetch(
      `https://api.github.com/repos/${repositories[c.scope]}`,
      {
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_SOURCE_TOKEN
          ? { Authorization: "Bearer " + process.env.GITHUB_SOURCE_TOKEN }
          : {}),
      },
    );
    if (visibility.private !== false)
      throw new Error("Only public GitHub repositories may be collected");
    const data = await jsonFetch(
      `https://api.github.com/repos/${repositories[c.scope]}/issues?${q}`,
      {
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_SOURCE_TOKEN
          ? { Authorization: "Bearer " + process.env.GITHUB_SOURCE_TOKEN }
          : {}),
      },
    );
    if (!Array.isArray(data)) throw new Error("Invalid GitHub page response");
    const beyond = data.some(
      (s: Issue) => new Date(s.updated_at || s.created_at).getTime() > until,
    );
    const records = data.filter(
      (s: Issue) =>
        !s.pull_request &&
        new Date(s.updated_at || s.created_at).getTime() <= until,
    );
    return {
      records,
      nextCursor:
        data.length === 100 && !beyond
          ? { scope: c.scope, page: c.page + 1 }
          : nextScope(c.scope, repositories.length, 1),
    };
  },
  normalizeSignal(s) {
    const content = cleanText(s.body || "");
    if (content.length < 20) return null;
    return signalSchema.parse({
      source: "github",
      externalId: String(s.id),
      url: s.html_url,
      author: s.user.login,
      title: s.title,
      content: content.slice(0, 30000),
      publishedAt: s.created_at,
      discoveredAt: new Date(),
      language: language(content),
      engagement: s.comments,
      metadata: { labels: s.labels.map((l) => l.name) },
    });
  },
  async healthCheck() {
    try {
      await jsonFetch(
        "https://api.github.com/rate_limit",
        process.env.GITHUB_SOURCE_TOKEN
          ? { Authorization: "Bearer " + process.env.GITHUB_SOURCE_TOKEN }
          : {},
      );
      return { ok: true, message: "GitHub API available" };
    } catch {
      return { ok: false, message: "GitHub API unavailable" };
    }
  },
};
type RedditPost = {
  id: string;
  permalink: string;
  author: string;
  title: string;
  selftext: string;
  created_utc: number;
  score: number;
  num_comments: number;
  subreddit: string;
};
async function redditToken() {
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET)
    throw new Error("Authorized Reddit API credentials required");
  const r = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          process.env.REDDIT_CLIENT_ID + ":" + process.env.REDDIT_CLIENT_SECRET,
        ).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.SOURCE_USER_AGENT || "PainRadar/0.1",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("Reddit authorization failed");
  return (await r.json()).access_token as string;
}
const reddit: SourceAdapter<RedditPost> = {
  id: "reddit",
  async fetchSignals(config) {
    const scopes =
      this.id === "github"
        ? (config.repositories || []).slice(0, 20).length
        : this.id === "reddit"
          ? (config.subreddits || []).slice(0, 10).length
          : (config.keywords?.length ? config.keywords : ["Ask HN"]).slice(
              0,
              10,
            ).length;
    if (!scopes) return (await this.fetchPage(config)).records;
    const result = [];
    for (let scope = 0; scope < scopes; scope++)
      result.push(
        ...(
          await this.fetchPage(config, {
            scope,
            page: this.id === "github" ? 1 : 0,
          })
        ).records,
      );
    return result;
  },
  async fetchPage(config, cursor) {
    const subs = config.subreddits?.slice(0, 10);
    if (!subs?.length)
      throw new Error("Configure Reddit communities before collecting");
    for (const sub of subs)
      if (!/^[a-zA-Z0-9_]{2,30}$/.test(sub))
        throw new Error("Invalid subreddit");
    const c = cursorValue(cursor, 0, subs.length);
    const { since, until } = bounds(config);
    const token = await redditToken();
    const q = new URLSearchParams({
      limit: "100",
      ...(c.after ? { after: c.after } : {}),
    });
    const data = await jsonFetch(
      `https://oauth.reddit.com/r/${subs[c.scope]}/new?${q}`,
      { Authorization: "Bearer " + token },
    );
    if (!Array.isArray(data.data?.children))
      throw new Error("Invalid Reddit page response");
    const posts: RedditPost[] = data.data.children.map(
      (item: { data: RedditPost }) => item.data,
    );
    const older = posts.some((p) => p.created_utc * 1000 < since);
    const after = data.data.after;
    if (
      after !== null &&
      after !== undefined &&
      (typeof after !== "string" || !/^t3_[a-z0-9]+$/.test(after))
    )
      throw new Error("Invalid Reddit continuation");
    if (after && after === c.after)
      throw new Error("Reddit returned a repeated continuation");
    return {
      records: posts.filter(
        (p) =>
          p.author !== "[deleted]" &&
          p.selftext !== "[removed]" &&
          p.created_utc * 1000 >= since &&
          p.created_utc * 1000 <= until,
      ),
      nextCursor:
        after && !older
          ? { scope: c.scope, page: c.page + 1, after }
          : nextScope(c.scope, subs.length, 0),
    };
  },
  normalizeSignal(s) {
    if (s.selftext.length < 20) return null;
    return signalSchema.parse({
      source: "reddit",
      externalId: s.id,
      url: "https://www.reddit.com" + s.permalink,
      author: s.author,
      title: s.title,
      content: s.selftext.slice(0, 30000),
      publishedAt: new Date(s.created_utc * 1000),
      discoveredAt: new Date(),
      language: language(s.selftext),
      engagement: Math.max(0, s.score + s.num_comments),
      metadata: { subreddit: s.subreddit },
    });
  },
  async healthCheck() {
    try {
      await redditToken();
      return { ok: true, message: "Reddit authorization available" };
    } catch {
      return {
        ok: false,
        message: "Authorized Reddit API access is not available",
      };
    }
  },
};
export const adapters: Record<RawSignal["source"], SourceAdapter> = {
  hn: hn as SourceAdapter,
  github: github as SourceAdapter,
  reddit: reddit as SourceAdapter,
};
export type { RawSignal, SourceConfig };

export type { SourceCursor, SourcePage };
