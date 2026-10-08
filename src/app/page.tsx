import { Text } from "@/components/language-provider";

import Link from "next/link";
import { db, databaseReady } from "@/db";
import { opportunities } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
export const dynamic = "force-dynamic";
import {
  ArrowUpRight,
  ScanLine,
  Layers,
  ChartNoAxesCombined,
  Check,
  Globe,
  Quote,
  ShieldCheck,
} from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
export default async function Home() {
  const live = databaseReady()
    ? await db()
        .select({
          slug: opportunities.slug,
          title: opportunities.title,
          mentions: opportunities.mentions,
          confidence: opportunities.confidence,
        })
        .from(opportunities)
        .where(eq(opportunities.public, true))
        .orderBy(desc(opportunities.score))
        .limit(3)
    : [];
  return (
    <PublicShell>
      <main>
        <section className="hero">
          <div className="eyebrow">
            <span className="dot" />
            <Text value={"MARKET INTELLIGENCE FOR BUILDERS"} />
          </div>
          <h1>
            <Text value={"Great products start"} />
            <br />
            <Text value={"with a"} />{" "}
            <span>
              <Text value={"real problem."} />
            </span>
          </h1>
          <p className="hero-copy">
            <Text
              value={
                "Find problems worth building. PainRadar analyzes public conversations and finds growing problems people are actively trying to solve."
              }
            />
          </p>
          <div className="hero-actions">
            <Button asChild>
              <Link href="/signup">
                <Text value={"Start free"} />
                <ArrowUpRight size={18} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/app/trending">
                <Text value={"Explore opportunities →"} />
              </Link>
            </Button>
          </div>
          <p className="hero-note">
            <Check size={14} />
            <Text value={"Evidence-backed insights"} />
            <span>·</span>
            <Text value={"No invented demand"} />
          </p>
          <div className="radar-visual" aria-hidden="true">
            <div className="orbit o1" />
            <div className="orbit o2" />
            <div className="orbit o3" />
            <div className="sweep" />
            <span className="signal s1" />
            <span className="signal s2" />
            <span className="signal s3" />
            <div className="radar-center">
              <ScanLine size={32} />
            </div>
            <div className="floating-label label-one">
              <Text value={"PUBLIC CONVERSATIONS"} />
            </div>
            <div className="floating-label label-two">
              <span className="dot" />
              <Text value={"Evidence → opportunity"} />
            </div>
          </div>
        </section>
        <section className="source-strip">
          <span>
            <Text value={"One view. Signals from across the internet."} />
          </span>
          <div>
            <b>reddit</b>
            <b>
              <span className="hn-icon">Y</span> Hacker News
            </b>
            <b>◉ GitHub Issues</b>
          </div>
        </section>
        <section className="section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                <Text value={"LESS GUESSWORK. MORE CONVICTION."} />
              </div>
              <h2>
                <Text value={"Your next idea deserves evidence."} />
              </h2>
            </div>
            <p>
              <Text
                value={
                  "Follow the problem from the first complaint to a validated opportunity."
                }
              />
            </p>
          </div>
          <div className="feature-grid">
            {[
              {
                icon: ScanLine,
                title: "Hear the signal",
                text: "Collect public complaints, feature requests, and workarounds. Every signal keeps its original source.",
              },
              {
                icon: Layers,
                title: "Connect the dots",
                text: "Group related pains, understand who feels them, and separate commercial intent from noise.",
              },
              {
                icon: ChartNoAxesCombined,
                title: "Watch demand grow",
                text: "Compare daily snapshots. See whether a problem is accelerating, stable, or fading.",
              },
            ].map((f, i) => (
              <article className="feature-card" key={f.title}>
                <span className="step">0{i + 1}</span>
                <f.icon size={25} />
                <h3>
                  <Text value={f.title} />
                </h3>
                <p>
                  <Text value={f.text} />
                </p>
              </article>
            ))}
          </div>
        </section>
        <section className="section evidence-section" id="how-it-works">
          <div>
            <div className="eyebrow">
              <Text value={"EVERY INSIGHT HAS A PAPER TRAIL"} />
            </div>
            <h2>
              <Text value={"Read the evidence."} />
              <br />
              <span className="muted">
                <Text value={"Then make your move."} />
              </span>
            </h2>
            <p>
              <Text
                value={
                  "Real conversations, original links, transparent scoring. AI helps interpret the evidence — it never invents it."
                }
              />
            </p>
            <ul className="check-list">
              <li>
                <ShieldCheck size={18} />
                <Text
                  value={"Facts, AI inference, and hypotheses clearly labeled"}
                />
              </li>
              <li>
                <Globe size={18} />
                <Text value={"Original sources one click away"} />
              </li>
              <li>
                <ChartNoAxesCombined size={18} />
                <Text value={"Confidence that reflects the sample size"} />
              </li>
            </ul>
            <Link className="text-link" href="/app">
              <Text value={"Open your intelligence workspace ↗"} />
            </Link>
          </div>
          <div className="evidence-preview">
            <div className="panel-header">
              <Quote size={18} />
              <span>
                <Text value={"EVIDENCE FEED"} />
              </span>
              <span className="badge">
                <Text value={"Live data only"} />
              </span>
            </div>
            {live.length ? (
              <div>
                {live.map((o) => (
                  <article className="evidence-card" key={o.slug}>
                    <span className="badge">
                      {o.confidence}
                      <Text value={"confidence"} />
                    </span>
                    <h3 style={{ marginTop: 14 }}>
                      <Link href={"/opportunities/" + o.slug}>{o.title} ↗</Link>
                    </h3>
                    <p>{o.mentions} observed public signals</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-evidence">
                <ScanLine size={38} />
                <h3>
                  <Text value={"Let the evidence lead."} />
                </h3>
                <p>
                  <Text
                    value={
                      "Opportunities appear after connected sources provide enough independent signals. No fabricated examples."
                    }
                  />
                </p>
                <Button asChild variant="outline">
                  <Link href="/signup">
                    <Text value={"Set up your first radar →"} />
                  </Link>
                </Button>
              </div>
            )}
            <div className="panel-footer">
              <span className="dot" />
              <Text value={"No claims without sources"} />
            </div>
          </div>
        </section>
        <section className="section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                <Text value={"BUILT FOR YOUR WORKFLOW"} />
              </div>
              <h2>
                <Text value={"From interesting to actionable."} />
              </h2>
            </div>
          </div>
          <div className="mini-grid">
            {[
              [
                "Custom radars",
                "Track a niche, audience, or keyword. Let the right signals come to you.",
              ],
              [
                "Opportunity watchlists",
                "Save problems worth following and see how their scores change.",
              ],
              [
                "Transparent scoring",
                "Frequency, velocity, commercial intent, pain intensity, and freshness.",
              ],
              [
                "Daily intelligence",
                "Snapshots and reports grounded in observed signals, not imagined revenue.",
              ],
            ].map(([t, d]) => (
              <article key={t}>
                <h3>
                  <Text value={t} /> ↗
                </h3>
                <p>
                  <Text value={d} />
                </p>
              </article>
            ))}
          </div>
        </section>
        <section className="section faq">
          <h2>
            <Text value={"Good questions."} />
          </h2>
          {[
            [
              "Does PainRadar generate startup ideas?",
              "It discovers and groups real problems first. MVP suggestions are hypotheses based on those signals, clearly separated from facts.",
            ],
            [
              "Where does the evidence come from?",
              "The first adapters collect public data from Hacker News, GitHub Issues, and authorized Reddit API access. Availability depends on source permissions and configuration.",
            ],
            [
              "Can a score guarantee demand?",
              "No. Scores summarize observed signals. Confidence reflects evidence volume, independent authors, source diversity, and freshness. Validate with potential customers before building.",
            ],
            [
              "Can I get started for free?",
              "Yes. The Free plan includes five opportunity opens per day, one custom radar, and seven days of history.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                <Text value={q} />
                <span>+</span>
              </summary>
              <p>
                <Text value={a} />
              </p>
            </details>
          ))}
        </section>
        <section className="final-cta">
          <div className="eyebrow">
            <Text value={"YOUR NEXT BUILD STARTS HERE"} />
          </div>
          <h2>
            <Text value={"Build with conviction."} />
          </h2>
          <p>
            <Text
              value={
                "Find the pain. Follow the evidence. Make something people need."
              }
            />
          </p>
          <Button asChild>
            <Link href="/signup">
              <Text value={"Start your radar"} />
              <ArrowUpRight size={18} />
            </Link>
          </Button>
        </section>
      </main>
    </PublicShell>
  );
}
