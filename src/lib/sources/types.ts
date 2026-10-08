import { detectLanguage } from "../detect-language";
import { z } from "zod";
export const signalSchema = z.object({
  source: z.enum(["hn", "github", "reddit"]),
  externalId: z.string().min(1).max(200),
  url: z
    .url()
    .refine(
      (value) => ["https:", "http:"].includes(new URL(value).protocol),
      "Public source URLs must use HTTP or HTTPS",
    ),
  author: z.string().min(1).max(200),
  title: z.string().max(1000),
  content: z.string().min(20).max(30000),
  publishedAt: z.coerce.date(),
  discoveredAt: z.coerce.date(),
  language: z.string().min(2).max(10),
  engagement: z.number().int().min(0),
  metadata: z.record(z.string(), z.unknown()),
});
export type RawSignal = z.infer<typeof signalSchema>;
export interface SourceConfig {
  keywords?: string[];
  repositories?: string[];
  subreddits?: string[];
  since?: string;
  until?: string;
  pageBudget?: number;
}
export interface SourceCursor {
  scope: number;
  page: number;
  after?: string;
}
export interface SourcePage<T = unknown> {
  records: T[];
  nextCursor: SourceCursor | null;
  warning?: string;
}
export interface CollectionState {
  configHash: string;
  since: string;
  until: string;
  cursor: SourceCursor;
  pages: number;
}
export interface SourceAdapter<T = unknown> {
  id: RawSignal["source"];
  fetchSignals(config: SourceConfig): Promise<T[]>;
  fetchPage(
    config: SourceConfig,
    cursor?: SourceCursor,
  ): Promise<SourcePage<T>>;
  normalizeSignal(input: T): RawSignal | null;
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}
export async function jsonFetch(
  url: string,
  headers: Record<string, string> = {},
) {
  const r = await fetch(url, {
    headers: {
      "User-Agent":
        process.env.SOURCE_USER_AGENT ||
        "PainRadar/0.1 (public market research)",
      ...headers,
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Source returned ${r.status}`);
  return r.json();
}
export function cleanText(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
export function language(text: string) {
  return detectLanguage(text);
}
