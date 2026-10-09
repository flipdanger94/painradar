import { sourceIds } from "@/lib/source-catalog";
import { languageCodes } from "@/lib/language-options";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { z } from "zod";
import { ApiError } from "./security";
const cursorSchema = z.object({
  v: z.literal(1),
  scope: z.string().length(64),
  score: z.number().min(0).max(100),
  id: z.uuid(),
  expires: z.number().int(),
});
export type PageCursor = { score: number; id: string };
function key() {
  const key = process.env.BETTER_AUTH_SECRET;
  if (!key || key.length < 32)
    throw new ApiError(503, "Pagination signing is not configured");
  return key;
}
export function pageScope(keyId: string, query: Record<string, unknown>) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        keyId,
        query: Object.fromEntries(
          Object.entries(query).sort(([a], [b]) => a.localeCompare(b)),
        ),
      }),
    )
    .digest("hex");
}
export function encodePageCursor(
  after: PageCursor,
  scope: string,
  now = Date.now(),
) {
  const data = Buffer.from(
    JSON.stringify({
      ...after,
      v: 1,
      scope,
      expires: Math.floor(now / 1000) + 900,
    }),
  ).toString("base64url");
  return (
    data + "." + createHmac("sha256", key()).update(data).digest("base64url")
  );
}
export function decodePageCursor(
  value: string,
  scope: string,
  now = Date.now(),
): PageCursor {
  if (value.length > 1000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value))
    throw new ApiError(400, "Invalid pagination cursor");
  const [body, sig] = value.split(".");
  const secret = key();
  try {
    const actual = Buffer.from(sig, "base64url");
    const expected = createHmac("sha256", secret).update(body).digest();
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new Error();
    const data = cursorSchema.parse(
      JSON.parse(Buffer.from(body, "base64url").toString()),
    );
    if (data.scope !== scope || data.expires <= Math.floor(now / 1000))
      throw new Error();
    return { score: data.score, id: data.id };
  } catch {
    throw new ApiError(
      400,
      "Pagination cursor is invalid, expired, or belongs to another query",
    );
  }
}
export const apiQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    industry: z.string().max(80).optional(),
    audience: z.string().max(100).optional(),
    source: z.enum(sourceIds).optional(),
    confidence: z.enum(["Low", "Medium", "High"]).optional(),
    score: z.coerce.number().int().min(0).max(100).optional(),
    growth: z.coerce.number().min(-100).max(10000).optional(),
    range: z.coerce.number().int().min(1).max(365).optional(),
    language: z.enum(languageCodes).optional(),
    competition: z.literal("known").optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().max(1000).optional(),
  })
  .strict();
