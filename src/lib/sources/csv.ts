import { z } from "zod";
import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import { signalSchema, type RawSignal, language } from "./types";
import { webhookUrl } from "../webhook-security";
export function csvSignals(csv: string): RawSignal[] {
  if (Buffer.byteLength(csv) > 500_000)
    throw new Error("CSV file is too large (maximum 500 KB).");
  const rows: Record<string, string>[] = parse(csv, {
    bom: true,
    columns: (headers: string[]) => {
      const clean = headers.map((h) => h.trim());
      if (
        new Set(clean).size !== clean.length ||
        !["title", "content", "url", "published_at"].every((k) =>
          clean.includes(k),
        ) ||
        clean.some(
          (k) =>
            !["title", "content", "url", "published_at", "author"].includes(k),
        )
      )
        throw new Error(
          "CSV requires title, content, url, published_at; author is optional.",
        );
      return clean;
    },
    skip_empty_lines: true,
    max_record_size: 40000,
  });
  if (!rows.length || rows.length > 200)
    throw new Error("CSV must contain between 1 and 200 records.");
  return rows.map((row, i) => {
    const url = row.url?.trim();
    try {
      webhookUrl(url);
    } catch {
      throw new Error(
        "CSV contains an invalid public HTTPS URL at row " + (i + 2),
      );
    }
    if (
      !z.iso.datetime({ offset: true }).safeParse(row.published_at).success ||
      !Number.isFinite(new Date(row.published_at).getTime()) ||
      new Date(row.published_at).getTime() > Date.now()
    )
      throw new Error("CSV contains an invalid timestamp at row " + (i + 2));
    const value = signalSchema.safeParse({
      source: "csv",
      externalId: createHash("sha256")
        .update(
          url + "\n" + row.published_at + "\n" + row.title + "\n" + row.content,
        )
        .digest("hex"),
      url,
      author: row.author?.trim() || "CSV import",
      title: row.title?.trim(),
      content: row.content?.trim(),
      publishedAt: row.published_at,
      discoveredAt: new Date(),
      language: language(row.content || ""),
      engagement: 0,
      metadata: { imported: true },
    });
    if (!value.success)
      throw new Error("CSV contains invalid signal fields at row " + (i + 2));
    return value.data;
  });
}
