import { databaseReady, db } from "@/db";
import { sources } from "@/db/schema";
export default async function Page() {
  const rows = databaseReady() ? await db().select().from(sources) : [];
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
      <div className="sources-grid">
        {list.map((source) => {
          const state = rows.find((r) => r.id === source.id);
          return (
            <article className="source-card" key={source.id}>
              <h3>{source.name}</h3>
              <span className="badge">
                {state?.enabled ? state.health : "Not connected"}
              </span>
              <p>{source.description}</p>
              <p className="text-small">
                Completed through:{" "}
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
