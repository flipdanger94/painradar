import type { MetadataRoute } from "next";
import { db, databaseReady } from "@/db";
import { opportunities, trends } from "@/db/schema";
import { eq } from "drizzle-orm";
export const revalidate = 3600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const urls: MetadataRoute.Sitemap = [
    "",
    "/pricing",
    "/privacy",
    "/terms",
  ].map((p) => ({ url: base + p }));
  if (!databaseReady()) return urls;
  const [os, ts] = await Promise.all([
    db().select().from(opportunities).where(eq(opportunities.public, true)),
    db().select().from(trends),
  ]);
  return [
    ...urls,
    ...os.map((o) => ({
      url: base + "/opportunities/" + o.slug,
      lastModified: o.updatedAt,
    })),
    ...ts.map((t) => ({ url: base + "/trends/" + t.slug })),
  ];
}
