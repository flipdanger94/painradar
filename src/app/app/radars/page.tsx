import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { radars, radarKeywords } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { RadarForm } from "@/components/radar-form";
import { ApiButton } from "@/components/actions";
import { EmptyState } from "@/components/empty-state";
export default async function Page() {
  const s = await getSession();
  const rows = s
    ? await db()
        .select()
        .from(radars)
        .where(and(eq(radars.userId, s.user.id), isNull(radars.workspaceId)))
    : [];
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">YOUR NICHE. YOUR SIGNAL.</div>
          <h1>Custom radars</h1>
          <p>
            Monitor opportunities by keywords, audience, source, and language.
          </p>
        </div>
      </div>
      <div className="detail-grid">
        <div>
          {rows.length ? (
            await Promise.all(
              rows.map(async (r) => {
                const k = await db()
                  .select()
                  .from(radarKeywords)
                  .where(eq(radarKeywords.radarId, r.id));
                return (
                  <section className="panel detail-block" key={r.id}>
                    <span className="badge">
                      {r.frequency} · score ≥ {r.alertThreshold}
                    </span>
                    <h2 style={{ marginTop: 18 }}>{r.name}</h2>
                    <p>{k.map((k) => k.keyword).join(", ")}</p>
                    <p className="text-small">
                      {r.sources.join(", ")} · {r.languages.join(", ")}
                    </p>
                    <ApiButton
                      endpoint="/api/radars"
                      method="DELETE"
                      payload={{ id: r.id }}
                      label="Delete radar"
                    />
                  </section>
                );
              }),
            )
          ) : (
            <section className="panel">
              <EmptyState
                title="Give your curiosity a direction."
                description="Your radars will match real collected opportunities. Creating a radar does not invent signals or bypass source configuration."
              />
            </section>
          )}
        </div>
        <section className="panel detail-block">
          <h2>Create a radar</h2>
          <RadarForm />
        </section>
      </div>
    </>
  );
}
