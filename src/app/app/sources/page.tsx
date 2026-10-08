import { serverTranslation } from "@/lib/i18n/server";
import { Text } from "@/components/language-provider";
import { PipelineMonitor } from "@/components/pipeline-monitor";
import { pipelineStatus } from "@/lib/pipeline-status";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { databaseReady, db } from "@/db";
import { sources } from "@/db/schema";
export default async function Page() {
  const t = await serverTranslation();
  const configured = databaseReady();
  const [rows, session] = await Promise.all([
    configured ? db().select().from(sources) : Promise.resolve([]),
    getSession(),
  ]);
  const admin = session?.user.role === "admin";
  const collectionReady =
    !!process.env.INNGEST_EVENT_KEY && !!process.env.INNGEST_SIGNING_KEY;
  const analysisReady = !!process.env.GEMINI_API_KEY;
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
  const status = await pipelineStatus();
  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">
            <Text value={"THE ORIGIN OF EVERY INSIGHT"} />
          </div>
          <h1>
            <Text value={"Data sources"} />
          </h1>
          <p>
            <Text
              value={
                "Collection is managed by the administrator. No private data is collected."
              }
            />
          </p>
        </div>
      </div>
      {(!configured || !rows.length || !collectionReady || !analysisReady) && (
        <section className="notice" style={{ marginBottom: 24 }}>
          <h2>
            <Text value={"Data collection setup"} />
          </h2>
          <p>
            {t(
              !configured
                ? "The database is not configured."
                : !rows.length
                  ? "No sources have been configured yet. Collection has not started."
                  : "Source configuration is saved.",
            )}
          </p>
          <p>
            {t(
              collectionReady
                ? "Background job keys are configured; the job service must also be connected to this app."
                : "Background collection is not configured. The administrator must connect Inngest and configure its event and signing keys.",
            )}
          </p>
          {!analysisReady && (
            <p>
              <Text
                value={
                  "AI analysis is not configured. The administrator must configure Gemini before opportunities can be analyzed."
                }
              />
            </p>
          )}
          {admin ? (
            <Link className="text-link" href="/admin">
              <Text value={"Configure sources in Admin →"} />
            </Link>
          ) : (
            <p>
              <Text
                value={
                  "Ask your administrator to complete setup and start the first collection."
                }
              />
            </p>
          )}
        </section>
      )}
      <PipelineMonitor
        initial={status}
        admin={session?.user.role === "admin"}
      />
      <div className="sources-grid">
        {list.map((source) => (
          <article className="source-card" key={source.id}>
            <h3>{source.name}</h3>
            <p>
              <Text value={source.description} />
            </p>
          </article>
        ))}
      </div>
      <div className="notice" style={{ marginTop: 25 }}>
        <Text
          value={
            "Collection reads up to 100 records per page, with a configured page budget and saved continuation between runs. Provider search/listing limits still apply. Source coverage is partial and does not represent the whole market."
          }
        />
      </div>
    </>
  );
}
