import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sources, rawSignals } from "@/db/schema";
import {
  endpoint,
  requireAdmin,
  rateLimit,
  ApiError,
  audit,
} from "@/lib/security";
import { csvSignals } from "@/lib/sources/csv";
import { canonicalUrl, contentHash } from "@/lib/pipeline";
import { z } from "zod";
export const POST = endpoint(async (req) => {
  const admin = await requireAdmin();
  await rateLimit(admin.id);
  if (Number(req.headers.get("content-length")) > 1_000_000)
    throw new ApiError(413, "CSV file is too large (maximum 500 KB).");
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, "Invalid CSV request.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.byteLength;
      if (size > 1_000_000) {
        await reader.cancel();
        throw new ApiError(413, "CSV file is too large (maximum 500 KB).");
      }
      chunks.push(r.value);
    }
  } finally {
    reader.releaseLock();
  }
  let parsed;
  try {
    parsed = z
      .object({ csv: z.string().min(1), confirmed: z.literal(true) })
      .strict()
      .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch {
    throw new ApiError(
      400,
      "Confirm that these records may be shared with signed-in users.",
    );
  }
  let signals;
  try {
    signals = csvSignals(parsed.csv);
  } catch (error) {
    throw new ApiError(
      400,
      error instanceof Error && error.message.startsWith("CSV ")
        ? error.message
        : "CSV could not be parsed. Check quotes, commas and column names.",
    );
  }
  await db()
    .insert(sources)
    .values({ id: "csv", name: "CSV import", enabled: false })
    .onConflictDoNothing();
  const added = await db()
    .insert(rawSignals)
    .values(
      signals.map((s) => ({
        ...s,
        url: canonicalUrl(s.url),
        contentHash: contentHash(s),
        discoveredAt: undefined,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: rawSignals.id });
  await db()
    .update(sources)
    .set({ health: "healthy", lastCollectedAt: new Date(), lastError: null })
    .where(eq(sources.id, "csv"));
  await audit(admin.id, "source.csv.imported", {
    records: signals.length,
    inserted: added.length,
  });
  return Response.json({
    inserted: added.length,
    duplicates: signals.length - added.length,
    total: signals.length,
  });
});
