import { sourceIds, sourceNames } from "./source-catalog";
import {
  claimInvoiceReconciliations,
  reconcileInvoices,
  failInvoiceReconciliation,
} from "./invoice-reconciliation";
import { maintenancePolicy, runMaintenance } from "./maintenance";
import { deliverWebhooks } from "./webhooks";
import {
  enqueuePublications,
  claimPublications,
  processPublication,
  publishWorkspace,
  releasePublication,
} from "./publications";
import {
  PIPELINE_LIMITS,
  planAnalysisBatch,
  commitAnalysisBatch,
  planGroupingBatch,
  commitGroupingBatch,
} from "./analysis-batches";
import { pipelineError } from "./pipeline-errors";
import { recordProgress } from "./pipeline-status";
import { Inngest } from "inngest";
import { embeddingModel, freeTier } from "./gemini";
import { db } from "@/db";
import { sources, jobRuns, rawSignals } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import * as pipeline from "./pipeline";
import { sendAlertEmails } from "./alerts";
import {
  claimBillingReconciliations,
  reconcileBilling,
  failBillingReconciliation,
} from "./billing-reconciliation";
export const inngest = new Inngest({ id: "painradar" });
export const dailyPipeline = inngest.createFunction(
  {
    id: "daily-radar",
    retries: 3,
    concurrency: { limit: 1 },
    onFailure: async ({ event }) => {
      await db()
        .update(jobRuns)
        .set({
          status: "failed",
          error: pipelineError(String(event.data.error?.message || "")),
          finishedAt: new Date(),
        })
        .where(
          eq(
            jobRuns.id,
            event.data.event.data.jobId || event.data.event.id || "",
          ),
        );
    },
  },
  [{ cron: "0 3 * * *" }, { event: "painradar/collect.requested" }],
  async ({ step, event }) => {
    const jobId = event.data.jobId || event.id || crypto.randomUUID();
    const started = await step.run("start", async () => {
      if (event.data.jobId) {
        const r = await db()
          .update(jobRuns)
          .set({ status: "running" })
          .where(and(eq(jobRuns.id, jobId), eq(jobRuns.status, "queued")))
          .returning();
        return r.length > 0;
      }
      const r = await db()
        .insert(jobRuns)
        .values({ id: jobId, job: "daily-radar", status: "running" })
        .onConflictDoNothing()
        .returning();
      return r.length > 0;
    });
    if (!started) return { skipped: true };
    const ids = await step.run("sources", async () => {
      await db()
        .insert(sources)
        .values([
          { id: "hn", name: "Hacker News", config: { keywords: ["Ask HN"] } },
          { id: "github", name: "GitHub Issues", enabled: false },
          { id: "reddit", name: "Reddit", enabled: false },
          ...sourceIds
            .filter((id) => !["hn", "github", "reddit"].includes(id))
            .map((id) => ({ id, name: sourceNames[id], enabled: false })),
        ])
        .onConflictDoNothing();
      return (
        await db().select().from(sources).where(eq(sources.enabled, true))
      ).map((s) => ({
        id: s.id,
        pageBudget: Math.min(
          10,
          Math.max(
            1,
            Math.trunc(
              Number((s.config as { pageBudget?: number }).pageBudget) || 3,
            ),
          ),
        ),
      }));
    });
    await step.run("progress-collect", () =>
      recordProgress(jobId, "collect", 0, ids.length),
    );
    for (const [sourceIndex, source] of (event.data.collectSources === false
      ? []
      : ids
    ).entries()) {
      for (let page = 0; page < source.pageBudget; page++) {
        const result = await step.run(
          "collectSource-" + source.id + "-page-" + page,
          async () => {
            try {
              return await pipeline.collectSourceBatch(source.id, 1);
            } catch {
              return {
                inserted: 0,
                complete: false,
                warning: "Source collection failed",
              };
            }
          },
        );
        if (
          result.complete ||
          ("warning" in result && result.warning) ||
          ("configurationChanged" in result && result.configurationChanged)
        )
          break;
      }
      await step.run("progress-source-" + source.id, () =>
        recordProgress(jobId, "collect", sourceIndex + 1, ids.length),
      );
    }
    const pendingEmbeddings = await step.run("pending-embeddings", async () =>
      db()
        .select({ id: rawSignals.id })
        .from(rawSignals)
        .where(
          and(
            sql`(${rawSignals.embedding} is null or (${rawSignals.embeddingModel} <> ${embeddingModel()} and ${rawSignals.processedAt} is null))`,
            isNull(rawSignals.duplicateOf),
            isNull(rawSignals.retiredAt),
          ),
        )
        .orderBy(rawSignals.discoveredAt)
        .limit(PIPELINE_LIMITS.embeddings),
    );
    await step.run("progress-embed", () =>
      recordProgress(jobId, "embed", 0, pendingEmbeddings.length),
    );
    for (const [index, signal] of pendingEmbeddings.entries()) {
      if (freeTier()) await step.sleep("embedding-quota-" + signal.id, "13s");
      await step.run("createEmbeddings-" + signal.id, () =>
        (async () => {
          const result = await pipeline.createEmbeddings(jobId, signal.id);
          await recordProgress(
            jobId,
            "embed",
            index + 1,
            pendingEmbeddings.length,
          );
          return result;
        })(),
      );
    }
    await step.run("deduplicateSignals", () => pipeline.deduplicateSignals());
    const grouping = await step.run("grouping-batch", () =>
      planGroupingBatch(),
    );
    const pendingClusters = grouping.ids.map((id) => ({ id }));
    await step.run("progress-group", () =>
      recordProgress(jobId, "group", 0, pendingClusters.length),
    );
    for (const [index, signal] of pendingClusters.entries()) {
      if (freeTier()) await step.sleep("analysis-quota-" + signal.id, "13s");
      await step.run("clusterSignals-" + signal.id, () =>
        (async () => {
          const result = await pipeline.clusterSignalsJob(jobId, signal.id);
          await recordProgress(
            jobId,
            "group",
            index + 1,
            pendingClusters.length,
          );
          return result;
        })(),
      );
    }
    await step.run("commit-grouping-batch", () =>
      commitGroupingBatch(grouping.previous, grouping.next),
    );
    const batch = await step.run("analysis-batch", () => planAnalysisBatch());
    await step.run("progress-analyze", () =>
      recordProgress(jobId, "analyze", 0, batch.ids.length),
    );
    for (const [index, id] of batch.ids.entries()) {
      if (freeTier()) await step.sleep("cluster-analysis-quota-" + id, "13s");
      await step.run("analyzeClusters-" + id, () =>
        pipeline.analyzeClusters(jobId, id),
      );
      await step.run("calculateScores-" + id, () =>
        (async () => {
          const result = await pipeline.calculateScores(id);
          await recordProgress(jobId, "analyze", index + 1, batch.ids.length);
          return result;
        })(),
      );
    }
    await step.run("commit-analysis-batch", () =>
      commitAnalysisBatch(batch.previous, batch.next),
    );
    await step.run("progress-publish", () =>
      recordProgress(jobId, "publish", 0, 1),
    );
    await step.run("updateTrends", () => pipeline.updateTrends());
    const day = await step.run("publication-day", () =>
      new Date().toISOString().slice(0, 10),
    );
    await step.run("createDailySnapshots", () =>
      pipeline.createDailySnapshots(day),
    );
    await step.run("generateReports", () => pipeline.generateReports(day));
    await step.run("enqueue-publications", () => enqueuePublications(day));
    await step.run("finish", () =>
      db()
        .update(jobRuns)
        .set({
          status: "completed",
          finishedAt: new Date(),
          progress: {
            stage: "done",
            done: 1,
            total: 1,
            updatedAt: new Date().toISOString(),
          },
        })
        .where(eq(jobRuns.id, jobId)),
    );
    return { jobId };
  },
);

export const webhookWorker = inngest.createFunction(
  { id: "webhook-deliveries", retries: 0, concurrency: { limit: 1 } },
  { cron: "* * * * *" },
  async ({ step }) => step.run("deliver", () => deliverWebhooks()),
);

export const publicationTask = inngest.createFunction(
  {
    id: "publication-task",
    retries: 3,
    concurrency: { limit: 5 },
    onFailure: async ({ event }) => {
      const data = event.data.event.data as { id: string; token: string };
      await db().execute(
        sql`update publication_jobs set lease_token=null,lease_until=null,updated_at=now(),last_error='Publication task exhausted retries' where id=${data.id}::uuid and lease_token=${data.token}::uuid and status='pending'`,
      );
    },
  },
  { event: "painradar/publication.process" },
  async ({ step, event }) => {
    const { id, token, workspaceId, day, kind } = event.data as {
      id: string;
      token: string;
      workspaceId: string | null;
      day: string;
      kind: string;
    };
    if (kind === "workspace" && workspaceId)
      return step.run("workspace-report", () =>
        publishWorkspace(id, token, workspaceId, day),
      );
    for (let page = 0; page < PIPELINE_LIMITS.publicationPages; page++) {
      const result = await step.run("radar-page-" + page, () =>
        processPublication(id, token),
      );
      if (result.complete || result.leaseLost) return result;
    }
    await step.run("release", () => releasePublication(id, token));
    return { complete: false };
  },
);
export const publicationWorker = inngest.createFunction(
  { id: "publication-dispatch", retries: 3, concurrency: { limit: 1 } },
  { cron: "* * * * *" },
  async ({ step }) => {
    const token = await step.run("owner-token", () => crypto.randomUUID());
    const jobs = await step.run("claim", () => claimPublications(token));
    await Promise.all(
      jobs.map((job) =>
        step.invoke("publish-" + job.id, {
          function: publicationTask,
          data: { ...job, token },
        }),
      ),
    );
    await step.run("alert-emails", () => sendAlertEmails());
    return { claimed: jobs.length };
  },
);
export const billingReconciliationTask = inngest.createFunction(
  {
    id: "billing-reconciliation-task",
    retries: 3,
    concurrency: { limit: 5 },
    onFailure: async ({ event }) => {
      const data = event.data.event.data as { userId: string; token: string };
      await failBillingReconciliation(data.userId, data.token);
    },
  },
  { event: "painradar/billing.reconcile" },
  async ({ step, event }) => {
    const { userId, token, reconciliationId } = event.data as {
      userId: string;
      token: string;
      reconciliationId: string;
    };
    return step.run("reconcile", () =>
      reconcileBilling(userId, token, reconciliationId),
    );
  },
);
export const billingReconciliationWorker = inngest.createFunction(
  {
    id: "billing-reconciliation-dispatch",
    retries: 3,
    concurrency: { limit: 1 },
  },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    if (!process.env.STRIPE_SECRET_KEY) return { configured: false };
    const token = await step.run("token", () => crypto.randomUUID());
    const accounts = await step.run("claim", () =>
      claimBillingReconciliations(token),
    );
    await Promise.all(
      accounts.map((account) =>
        step.invoke("account-" + account.userId, {
          function: billingReconciliationTask,
          data: { ...account, token },
        }),
      ),
    );
    return { claimed: accounts.length };
  },
);

export const maintenanceWorker = inngest.createFunction(
  { id: "data-maintenance", retries: 3, concurrency: { limit: 1 } },
  { cron: "15 * * * *" },
  async ({ step }) => {
    const policy = await step.run("policy", () => maintenancePolicy());
    if (!policy.enabled) return { skipped: true };
    const id = await step.run("run-id", () => crypto.randomUUID());
    return step.run("bounded-cleanup", async () => {
      const result = await runMaintenance(id, false, policy);
      if (result.busy)
        throw new Error("Maintenance lock is busy; retry this batch");
      return result;
    });
  },
);

export const invoiceReconciliationTask = inngest.createFunction(
  {
    id: "invoice-reconciliation-task",
    retries: 3,
    concurrency: { limit: 5 },
    onFailure: async ({ event }) => {
      const data = event.data.event.data as {
        customerId: string;
        token: string;
      };
      await failInvoiceReconciliation(data.customerId, data.token);
    },
  },
  { event: "painradar/invoices.reconcile" },
  async ({ step, event }) => {
    const { customerId, token } = event.data as {
      customerId: string;
      token: string;
    };
    return step.run("invoice-page", () => reconcileInvoices(customerId, token));
  },
);
export const invoiceReconciliationWorker = inngest.createFunction(
  {
    id: "invoice-reconciliation-dispatch",
    retries: 3,
    concurrency: { limit: 1 },
  },
  { cron: "*/5 * * * *" },
  async ({ step }) => {
    if (!process.env.STRIPE_SECRET_KEY) return { configured: false };
    const token = await step.run("token", () => crypto.randomUUID());
    const accounts = await step.run("claim", () =>
      claimInvoiceReconciliations(token),
    );
    await Promise.all(
      accounts.map((account) =>
        step.invoke("customer-" + account.customerId, {
          function: invoiceReconciliationTask,
          data: { ...account, token },
        }),
      ),
    );
    return { claimed: accounts.length };
  },
);
