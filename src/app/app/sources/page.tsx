import Link from "next/link";
import { getSession } from "@/lib/auth";
import { databaseReady, db } from "@/db";
import { sources } from "@/db/schema";
export default async function Page() {
  const configured = databaseReady();
  const [rows, session] = await Promise.all([
    configured ? db().select().from(sources) : Promise.resolve([]),
    getSession(),
  ]);
  const admin = session?.user.role === "admin";
  const collectionReady =
    !!process.env.INNGEST_EVENT_KEY && !!process.env.INNGEST_SIGNING_KEY;
  const analysisReady = !!process.env.OPENAI_API_KEY;
  const list = [
    {
      id: "hn",
      name: "Hacker News",
      description: "Public stories and comments through the Algolia API.",
    },
    {
      id: "github",
      name: "GitHub Issues",
      description: "Public issues in explicitly configured repositories.",
    },
    {
      id: "reddit",
      name: "Reddit",
      description:
        "Public posts in configured communities, using authorized Reddit API access.",
    },
  ];
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">THE ORIGIN OF EVERY INSIGHT</div>
          <h1>Data sources</h1>
          <p>
            Collection is managed by the administrator. No private data is
            collected.
          </p>
        </div>
      </div>
      {(!configured || !rows.length || !collectionReady || !analysisReady) && (
        <section className="notice" style={{ marginBottom: 24 }}>
          <h2>Data collection setup</h2>
          <p>
            {!configured
              ? "The database is not configured."
              : !rows.length
                ? "No sources have been configured yet. Collection has not started."
                : "Source configuration is saved."}
          </p>
          <p>
            {collectionReady
              ? "Background job keys are configured; the job service must also be connected to this app."
              : "Background collection is not configured. The administrator must connect Inngest and configure its event and signing keys."}
          </p>
          {!analysisReady && (
            <p>
              AI analysis is not configured. The administrator must configure
              OpenAI before opportunities can be analyzed.
            </p>
          )}
          {admin ? (
            <Link className="text-link" href="/admin">
              Configure sources in Admin →
            </Link>
          ) : (
            <p>
              Ask your administrator to complete setup and start the first
              collection.
            </p>
          )}
        </section>
      )}
      <div className="sources-grid">
        {list.map((source) => {
          const state = rows.find((r) => r.id === source.id);
          return (
            <article className="source-card" key={source.id}>
              <h3>{source.name}</h3>
              <span className="badge">
                {!state
                  ? "Not configured"
                  : !state.enabled
                    ? "Disabled"
                    : !state.lastCollectedAt
                      ? "Awaiting first collection"
                      : state.health}
              </span>
              <p>{source.description}</p>
              <p className="text-small">
                Collection completed through:{" "}
                {state?.lastCollectedAt
                  ?.toISOString()
                  .slice(0, 16)
                  .replace("T", " ") || "Never"}
              </p>
              {state?.lastError && (
                <p className="error-message">{state.lastError}</p>
              )}
            </article>
          );
        })}
      </div>
      <div className="notice" style={{ marginTop: 25 }}>
        Collection reads up to 100 records per page, with a configured page
        budget and saved continuation between runs. Provider search/listing
        limits still apply. Source coverage is partial and does not represent
        the whole market.
      </div>
    </>
  );
}
