import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import {
  cleanText,
  language,
  signalSchema,
  type RawSignal,
  type SourceAdapter,
  type SourceConfig,
  type SourceCursor,
  type SourcePage,
} from "./types";
import { publicFetch, publicJson } from "./public-fetch";
import { webhookUrl } from "../webhook-security";
type Item = RawSignal;
function normalized(
  source: RawSignal["source"],
  item: {
    id: string;
    url: string;
    author?: string;
    title: string;
    content: string;
    date: string | number;
    engagement?: number;
    metadata?: Record<string, unknown>;
  },
) {
  const content = cleanText(item.content).slice(0, 30000);
  if (content.length < 20) return null;
  const parsed = signalSchema.safeParse({
    source,
    externalId: item.id.slice(0, 200),
    url: item.url,
    author: cleanText(item.author || "Anonymous").slice(0, 200) || "Anonymous",
    title: cleanText(item.title).slice(0, 1000),
    content,
    publishedAt: new Date(item.date),
    discoveredAt: new Date(),
    language: language(content),
    engagement: Math.max(0, Math.trunc(item.engagement || 0)),
    metadata: item.metadata || {},
  });
  return parsed.success ? parsed.data : null;
}
function windowed(items: Item[], config: SourceConfig) {
  const since = new Date(config.since || Date.now() - 7 * 86400000).getTime(),
    until = new Date(config.until || Date.now()).getTime();
  if (!Number.isFinite(since) || !Number.isFinite(until) || since > until)
    throw new Error("Invalid collection time window");
  return items.filter(
    (s) => s.publishedAt.getTime() >= since && s.publishedAt.getTime() <= until,
  );
}
function cursor(config: SourceCursor | undefined, total: number): SourceCursor {
  const c = config || { scope: 0, page: 0 };
  if (
    !total ||
    !Number.isInteger(c.scope) ||
    c.scope < 0 ||
    c.scope >= total ||
    !Number.isInteger(c.page) ||
    c.page < 0 ||
    c.page > 10000
  )
    throw new Error("Invalid source cursor");
  if (c.retryAt && new Date(c.retryAt).getTime() > Date.now())
    throw new Error("Source retry later");
  return c;
}
function nextScope(c: SourceCursor, total: number) {
  return c.scope + 1 < total ? { scope: c.scope + 1, page: 0 } : null;
}
function adapter(
  id: RawSignal["source"],
  fetchPage: (
    config: SourceConfig,
    cursor?: SourceCursor,
  ) => Promise<SourcePage<Item>>,
): SourceAdapter<Item> {
  return {
    id,
    fetchPage,
    async fetchSignals(config) {
      return (await fetchPage(config)).records;
    },
    normalizeSignal: (item) => signalSchema.parse(item),
    async healthCheck() {
      return {
        ok: true,
        message: "Configure public source scopes before collecting",
      };
    },
  };
}
export const stackexchange = adapter("stackexchange", async (config, start) => {
  const tags = config.tags?.slice(0, 10);
  if (!tags?.length)
    throw new Error("Configure source scopes before collecting");
  if (
    tags.some((t) => !/^[-+.a-zA-Z0-9#]{1,50}$/.test(t)) ||
    !/^[-a-z0-9.]{2,80}$/.test(config.site || "stackoverflow")
  )
    throw new Error("Invalid source configuration");
  const c = cursor(start, tags.length);
  if (c.done) return { records: [], nextCursor: null };
  const q = new URLSearchParams({
    site: config.site || "stackoverflow",
    tagged: tags[c.scope],
    order: "desc",
    sort: "creation",
    page: String(c.page + 1),
    pagesize: "100",
    filter: "withbody",
    fromdate: String(
      Math.floor(
        new Date(config.since || Date.now() - 7 * 86400000).getTime() / 1000,
      ),
    ),
    todate: String(
      Math.floor(new Date(config.until || Date.now()).getTime() / 1000),
    ),
  });
  if (process.env.STACKEXCHANGE_KEY)
    q.set("key", process.env.STACKEXCHANGE_KEY);
  const { data } = await publicJson(
    "https://api.stackexchange.com/2.3/questions?" + q,
  );
  if (data.error_id || !Array.isArray(data.items))
    throw new Error("Invalid source response");
  const records = data.items
    .map(
      (p: {
        question_id: number;
        content_license?: string;
        link: string;
        owner?: { display_name?: string; link?: string };
        title: string;
        body: string;
        creation_date: number;
        score: number;
        answer_count: number;
      }) =>
        normalized("stackexchange", {
          id: (config.site || "stackoverflow") + ":" + p.question_id,
          url: p.link,
          author: p.owner?.display_name,
          title: p.title,
          content: p.body || "",
          date: p.creation_date * 1000,
          engagement: p.score + p.answer_count,
          metadata: {
            license: p.content_license || "CC BY-SA",
            attributionUrl: p.link,
            authorUrl: p.owner?.link,
            site: config.site || "stackoverflow",
          },
        }),
    )
    .filter((p: Item | null): p is Item => p !== null);
  const next = data.has_more
    ? { scope: c.scope, page: c.page + 1 }
    : nextScope(c, tags.length);
  const backoff = Number(data.backoff || 0);
  const quota =
    typeof data.quota_remaining === "number" && data.quota_remaining <= 0;
  if (backoff > 0 || quota) {
    const retry = quota
      ? new Date(new Date().setUTCHours(24, 0, 0, 0))
      : new Date(Date.now() + Math.max(60, backoff) * 1000);
    return {
      records: windowed(records, config),
      nextCursor: next || { ...c, done: true },
      warning: quota
        ? "Source daily quota reached"
        : "Source backoff requested",
      pauseUntil: retry.toISOString(),
    };
  }
  return { records: windowed(records, config), nextCursor: next };
});
export const gitlab = adapter("gitlab", async (config, start) => {
  const projects = config.projects?.slice(0, 20);
  if (!projects?.length)
    throw new Error("Configure source scopes before collecting");
  if (
    projects.some(
      (p) =>
        !/^[-a-zA-Z0-9_.]+(?:\/[-a-zA-Z0-9_.]+)+$/.test(p) ||
        p.split("/").some((s) => s === "." || s === ".."),
    )
  )
    throw new Error("Invalid source configuration");
  const c = cursor(start, projects.length);
  const root =
    "https://gitlab.com/api/v4/projects/" +
    encodeURIComponent(projects[c.scope]);
  const visibility = await publicJson(root);
  if (visibility.data.visibility !== "public")
    throw new Error("Only public projects are supported");
  const q = new URLSearchParams({
    scope: "all",
    state: "all",
    per_page: "100",
    page: String(c.page + 1),
    order_by: "created_at",
    sort: "desc",
    created_after:
      config.since || new Date(Date.now() - 7 * 86400000).toISOString(),
    created_before: config.until || new Date().toISOString(),
  });
  const { data, headers } = await publicJson(root + "/issues?" + q);
  if (!Array.isArray(data)) throw new Error("Invalid source response");
  const records = data
    .filter((p) => p.confidential !== true)
    .map((p) =>
      normalized("gitlab", {
        id: projects[c.scope] + ":" + p.iid,
        url: p.web_url,
        author: p.author?.username,
        title: p.title,
        content: p.description || "",
        date: p.created_at,
        engagement: (p.upvotes || 0) + (p.user_notes_count || 0),
        metadata: { project: projects[c.scope] },
      }),
    )
    .filter((p: Item | null): p is Item => p !== null);
  const more =
    typeof headers["x-next-page"] === "string"
      ? headers["x-next-page"] !== ""
      : data.length === 100;
  return {
    records: windowed(records, config),
    nextCursor: more
      ? { scope: c.scope, page: c.page + 1 }
      : nextScope(c, projects.length),
  };
});
export const discourse = adapter("discourse", async (config, start) => {
  const forums = config.forums?.slice(0, 10);
  if (!forums?.length)
    throw new Error("Configure source scopes before collecting");
  forums.forEach(webhookUrl);
  const c = cursor(start, forums.length);
  if (c.after && !/^\d{1,20}$/.test(c.after))
    throw new Error("Invalid source cursor");
  const base = new URL(forums[c.scope].replace(/\/?$/, "/"));
  const endpoint = new URL("posts.json", base);
  if (c.after) endpoint.searchParams.set("before", c.after);
  const { data } = await publicJson(endpoint.toString());
  if (!Array.isArray(data.latest_posts))
    throw new Error("Invalid source response");
  const posts = data.latest_posts;
  const records = posts
    .filter(
      (p: { hidden?: boolean; deleted_at?: string }) =>
        !p.hidden && !p.deleted_at,
    )
    .map(
      (p: {
        id: number;
        topic_id: number;
        post_number: number;
        topic_title: string;
        cooked: string;
        username: string;
        created_at: string;
        reply_count: number;
      }) =>
        normalized("discourse", {
          id: createHash("sha256")
            .update(base.toString() + ":" + p.id)
            .digest("hex"),
          url: new URL(
            "t/" + p.topic_id + "/" + p.post_number,
            base,
          ).toString(),
          author: p.username,
          title: p.topic_title || "Discussion",
          content: p.cooked || "",
          date: p.created_at,
          engagement: p.reply_count,
          metadata: { forum: base.toString(), postId: p.id },
        }),
    )
    .filter((p: Item | null): p is Item => p !== null);
  const oldest = posts.length
    ? Math.min(...posts.map((p: { id: number }) => p.id))
    : 0;
  if (
    !Number.isSafeInteger(oldest) ||
    oldest < 0 ||
    (c.after && oldest >= Number(c.after))
  )
    throw new Error("Invalid source continuation");
  const finished =
    posts.length === 0 ||
    posts.some(
      (p: { created_at: string }) =>
        new Date(p.created_at).getTime() <
        new Date(config.since || Date.now() - 7 * 86400000).getTime(),
    );
  return {
    records: windowed(records, config),
    nextCursor: finished
      ? nextScope(c, forums.length)
      : { scope: c.scope, page: c.page + 1, after: String(oldest) },
  };
});
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (value && typeof value === "object")
    return text((value as Record<string, unknown>)["#text"]);
  return "";
}
function list<T>(v: T | T[] | undefined): T[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}
export function parseFeed(xml: string, feedUrl: string): Item[] {
  if (
    Buffer.byteLength(xml) > 2_000_000 ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  )
    throw new Error("Invalid feed response");
  const doc = new XMLParser({
    ignoreAttributes: false,
    processEntities: false,
    parseTagValue: false,
  }).parse(xml);
  const atom = !!doc.feed;
  const entries = atom
    ? list(doc.feed.entry)
    : list(doc.rss?.channel?.item || doc["rdf:RDF"]?.item);
  if (!doc.feed && !doc.rss && !doc["rdf:RDF"])
    throw new Error("Invalid feed response");
  return entries
    .slice(0, 200)
    .map((p: Record<string, unknown>) => {
      const links = list(p.link);
      const link = atom
        ? links.find(
            (l) =>
              typeof l === "object" &&
              l !== null &&
              (!("@_rel" in l) ||
                (l as Record<string, unknown>)["@_rel"] === "alternate"),
          )
        : p.link;
      const href = atom
        ? text(
            link && typeof link === "object"
              ? (link as Record<string, unknown>)["@_href"]
              : link,
          )
        : text(link);
      if (!href) return null;
      let url: string;
      try {
        url = new URL(href, feedUrl).toString();
        webhookUrl(url);
      } catch {
        return null;
      }
      const rawDate = text(
        p.pubDate || p.published || p.updated || p["dc:date"],
      );
      if (!rawDate || !Number.isFinite(new Date(rawDate).getTime()))
        return null;
      return normalized("rss", {
        id: createHash("sha256")
          .update(feedUrl + ":" + text(p.guid || p.id || url))
          .digest("hex"),
        url,
        author: atom
          ? text((p.author as Record<string, unknown>)?.name)
          : text(p.author || p["dc:creator"]),
        title: text(p.title),
        content: text(
          p["content:encoded"] || p.content || p.description || p.summary,
        ),
        date: rawDate,
        metadata: { feedUrl },
      });
    })
    .filter((p: Item | null): p is Item => p !== null);
}
export const rss = adapter("rss", async (config, start) => {
  const feeds = config.feeds?.slice(0, 10);
  if (!feeds?.length)
    throw new Error("Configure source scopes before collecting");
  feeds.forEach(webhookUrl);
  const c = cursor(start, feeds.length);
  const r = await publicFetch(feeds[c.scope]);
  return {
    records: windowed(parseFeed(r.text, feeds[c.scope]), config),
    nextCursor: nextScope(c, feeds.length),
  };
});
export const csv = adapter("csv", async () => ({
  records: [],
  nextCursor: null,
}));
