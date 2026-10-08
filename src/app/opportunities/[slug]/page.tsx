import Link from "next/link";
import { notFound } from "next/navigation";
import { opportunity } from "@/lib/queries";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const o = await opportunity(slug);
  if (!o?.public)
    return { title: "Opportunity unavailable", robots: { index: false } };
  return {
    title: o.title,
    description: o.summary.slice(0, 155),
    alternates: { canonical: "/opportunities/" + o.slug },
    openGraph: { images: ["/opportunities/" + o.slug + "/opengraph-image"] },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const o = await opportunity(slug);
  if (!o?.public) notFound();
  const url =
    (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000") +
    "/opportunities/" +
    o.slug;
  const shareText = encodeURIComponent(
    o.title + " — " + o.mentions + " observed signals on PainRadar",
  );
  return (
    <PublicShell>
      <main className="content-page legal">
        <div className="eyebrow">PUBLIC EVIDENCE PREVIEW · {o.industry}</div>
        <h1>{o.title}</h1>
        <span className="badge">AI inference from observed signals</span>
        <p style={{ marginTop: 22 }}>{o.summary}</p>
        <div className="metrics" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="metric">
            <div className="metric-label">Observed signals</div>
            <div className="metric-value">{o.mentions}</div>
          </div>
          <div className="metric">
            <div className="metric-label">Confidence</div>
            <div className="metric-value">{o.confidence}</div>
          </div>
        </div>
        <p>
          Read original evidence, the score breakdown, and historical snapshots
          in your workspace.
        </p>
        <Button asChild>
          <Link prefetch={false} href={"/app/opportunities/" + o.id}>
            Explore the evidence ↗
          </Link>
        </Button>
        <div className="section-rule">
          <p>Share this opportunity</p>
          <div className="card-meta">
            {[
              [
                "X",
                "https://twitter.com/intent/tweet?text=" +
                  shareText +
                  "&url=" +
                  encodeURIComponent(url),
              ],
              [
                "LinkedIn",
                "https://www.linkedin.com/sharing/share-offsite/?url=" +
                  encodeURIComponent(url),
              ],
              [
                "Reddit",
                "https://www.reddit.com/submit?url=" +
                  encodeURIComponent(url) +
                  "&title=" +
                  shareText,
              ],
              [
                "Telegram",
                "https://t.me/share/url?url=" +
                  encodeURIComponent(url) +
                  "&text=" +
                  shareText,
              ],
            ].map(([name, href]) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="button button-outline button-sm"
              >
                {name} ↗
              </a>
            ))}
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
