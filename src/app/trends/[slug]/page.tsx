import { Text } from "@/components/language-provider";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, databaseReady } from "@/db";
import { trends, trendOpportunities, opportunities } from "@/db/schema";
import { PublicShell } from "@/components/public-shell";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!databaseReady()) return { robots: { index: false } };
  const t = (await db().select().from(trends).where(eq(trends.slug, slug)))[0];
  return {
    title: t?.title || "Trend unavailable",
    description: t?.summary,
    alternates: { canonical: "/trends/" + slug },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!databaseReady()) notFound();
  const { slug } = await params;
  const t = (await db().select().from(trends).where(eq(trends.slug, slug)))[0];
  if (!t) notFound();
  const os = await db()
    .select({ o: opportunities })
    .from(trendOpportunities)
    .innerJoin(
      opportunities,
      eq(opportunities.id, trendOpportunities.opportunityId),
    )
    .where(eq(trendOpportunities.trendId, t.id));
  return (
    <PublicShell>
      <main className="content-page">
        <div className="eyebrow">EVIDENCE-BACKED THEME</div>
        <h1>{t.title}</h1>
        <p>{t.summary}</p>
        <div className="mini-grid">
          {os
            .filter((r) => r.o.public)
            .map(({ o }) => (
              <article key={o.id}>
                <h3>
                  <Link href={"/opportunities/" + o.slug}>{o.title} ↗</Link>
                </h3>
                <p>
                  {o.mentions} observed signals · {o.confidence}
                  <Text value={"confidence"} />
                </p>
              </article>
            ))}
        </div>
      </main>
    </PublicShell>
  );
}
