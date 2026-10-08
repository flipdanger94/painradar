import { db } from "@/db";
import { rawSignals, clusterSignals } from "@/db/schema";
import { eq } from "drizzle-orm";
// Only expose named external solutions that appear as actual source links. No AI-generated company catalog.
export async function competitorEvidence(clusterId: string) {
  const rows = await db()
    .select({
      id: rawSignals.id,
      content: rawSignals.content,
      url: rawSignals.url,
    })
    .from(clusterSignals)
    .innerJoin(rawSignals, eq(rawSignals.id, clusterSignals.signalId))
    .where(eq(clusterSignals.clusterId, clusterId));
  const links = new Map<
    string,
    { url: string; evidenceId: string; sourceUrl: string }
  >();
  for (const r of rows)
    for (const value of r.content.match(/https?:\/\/[^\s<>"")]+/g) || []) {
      try {
        const url = new URL(value);
        if (
          [
            "github.com",
            "reddit.com",
            "www.reddit.com",
            "news.ycombinator.com",
          ].includes(url.hostname)
        )
          continue;
        if (!links.has(url.hostname))
          links.set(url.hostname, {
            url: url.origin,
            evidenceId: r.id,
            sourceUrl: r.url,
          });
      } catch {
        continue;
      }
    }
  return [...links.values()].slice(0, 15);
}
