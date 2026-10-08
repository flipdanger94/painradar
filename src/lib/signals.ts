import { db, databaseReady } from "@/db";
import { rawSignals } from "@/db/schema";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { embeddingModel } from "./gemini";
export const signalStates = [
  "queued",
  "related",
  "processed",
  "duplicate",
] as const;
export type SignalState = (typeof signalStates)[number];
export function signalFilters(
  input: Record<string, string | string[] | undefined>,
) {
  const value = (key: string) =>
    typeof input[key] === "string" ? (input[key] as string) : "";
  const page = Number(value("page"));
  return {
    q: value("q").trim().slice(0, 200),
    source: ["hn", "github", "reddit"].includes(value("source"))
      ? value("source")
      : "",
    state: signalStates.includes(value("state") as SignalState)
      ? (value("state") as SignalState)
      : "",
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1,
  };
}
export type SignalFilters = ReturnType<typeof signalFilters>;
export function signalPageHref(filters: SignalFilters, page: number) {
  const params = new URLSearchParams();
  for (const key of ["q", "source", "state"] as const)
    if (filters[key]) params.set(key, filters[key]);
  params.set("page", String(page));
  return "/app/signals?" + params;
}
export async function listSignals(filters: SignalFilters) {
  if (!databaseReady()) return { rows: [], total: 0, page: 1, pages: 1 };
  const ready = sql`${rawSignals.embedding} is not null and ${rawSignals.embeddingModel}=${embeddingModel()}`;
  const pending = sql`(${rawSignals.embedding} is null or ${rawSignals.embeddingModel}<>${embeddingModel()})`;
  const q = "%" + filters.q.replace(/[\\%_]/g, "\\$&") + "%";
  const where = and(
    isNull(rawSignals.retiredAt),
    filters.source ? eq(rawSignals.source, filters.source) : undefined,
    filters.q
      ? or(ilike(rawSignals.title, q), ilike(rawSignals.content, q))
      : undefined,
    filters.state === "duplicate"
      ? sql`${rawSignals.duplicateOf} is not null`
      : filters.state === "processed"
        ? and(
            sql`${rawSignals.processedAt} is not null`,
            isNull(rawSignals.duplicateOf),
          )
        : filters.state === "related"
          ? and(
              ready,
              isNull(rawSignals.processedAt),
              isNull(rawSignals.duplicateOf),
            )
          : filters.state === "queued"
            ? and(
                pending,
                isNull(rawSignals.processedAt),
                isNull(rawSignals.duplicateOf),
              )
            : undefined,
  );
  const total = await db().$count(rawSignals, where);
  const pages = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(filters.page, pages);
  const rows = await db()
    .select({
      id: rawSignals.id,
      source: rawSignals.source,
      title: rawSignals.title,
      excerpt: sql<string>`left(${rawSignals.content},240)`,
      url: rawSignals.url,
      author: rawSignals.author,
      language: rawSignals.language,
      publishedAt: rawSignals.publishedAt,
      state: sql<SignalState>`case when ${rawSignals.duplicateOf} is not null then 'duplicate' when ${rawSignals.processedAt} is not null then 'processed' when ${ready} then 'related' else 'queued' end`,
    })
    .from(rawSignals)
    .where(where)
    .orderBy(desc(rawSignals.discoveredAt), desc(rawSignals.id))
    .limit(20)
    .offset((page - 1) * 20);
  return { rows, total, page, pages };
}
export const signalStateLabels: Record<SignalState, string> = {
  queued: "Waiting for AI processing",
  related: "Waiting for related evidence",
  processed: "Reviewed",
  duplicate: "Duplicate",
};
