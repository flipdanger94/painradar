import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  SourceAdapter,
  SourceConfig,
  CollectionState,
  SourcePage,
} from "./types";
const stateSchema = z.object({
  configHash: z.string(),
  since: z.iso.datetime(),
  until: z.iso.datetime(),
  cursor: z.object({
    scope: z.number().int().min(0).max(19),
    page: z.number().int().min(0).max(10000),
    after: z.string().max(100).optional(),
    retryAt: z.iso.datetime().optional(),
    done: z.boolean().optional(),
  }),
  pages: z.number().int().min(0),
});
export function collectionConfigHash(config: SourceConfig) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        keywords: config.keywords || [],
        repositories: config.repositories || [],
        subreddits: config.subreddits || [],
        since: config.since || null,
        ...(config.tags
          ? { tags: config.tags, site: config.site || "stackoverflow" }
          : {}),
        ...(config.projects ? { projects: config.projects } : {}),
        ...(config.forums ? { forums: config.forums } : {}),
        ...(config.feeds ? { feeds: config.feeds } : {}),
      }),
    )
    .digest("hex");
}
export function collectionWindow(
  source: SourceAdapter,
  config: SourceConfig,
  stored: unknown,
  lastCollectedAt: Date | null,
  now = new Date(),
): CollectionState {
  const configHash = collectionConfigHash(config);
  if (stored) {
    const s = stateSchema.parse(stored);
    if (s.configHash === configHash) return s;
  }
  const since = (
    lastCollectedAt
      ? new Date(lastCollectedAt.getTime() - 3600000)
      : new Date(config.since || now.getTime() - 7 * 86400000)
  ).toISOString();
  if (new Date(since) > now)
    throw new Error("Backfill start date must not be in the future");
  return {
    configHash,
    since,
    until: now.toISOString(),
    cursor: { scope: 0, page: source.id === "github" ? 1 : 0 },
    pages: 0,
  };
}
export async function collectWindow<T>(
  adapter: SourceAdapter<T>,
  config: SourceConfig,
  initial: CollectionState,
  onPage: (
    page: SourcePage<T>,
    state: CollectionState,
    complete: boolean,
  ) => Promise<boolean>,
) {
  const budget = z
    .number()
    .int()
    .min(1)
    .max(10)
    .parse(config.pageBudget ?? 3);
  let state = initial;
  let records = 0;
  for (let i = 0; i < budget; i++) {
    const page = await adapter.fetchPage(
      { ...config, since: state.since, until: state.until },
      state.cursor,
    );
    const complete = page.nextCursor === null && !page.warning;
    const next = {
      ...state,
      cursor: page.pauseUntil
        ? { ...(page.nextCursor || state.cursor), retryAt: page.pauseUntil }
        : page.warning
          ? state.cursor
          : page.nextCursor || state.cursor,
      pages: state.pages + 1,
    };
    if (!(await onPage(page, next, complete)))
      return { records, complete: false, configurationChanged: true };
    records += page.records.length;
    state = next;
    if (complete || page.warning)
      return { records, complete, warning: page.warning };
  }
  return { records, complete: false };
}
