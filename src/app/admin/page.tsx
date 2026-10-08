import {
  invoiceReconciliationHealth,
  recentInvoiceReconciliationErrors,
} from "@/lib/invoice-reconciliation";
import { maintenanceStatus } from "@/lib/maintenance";
import { redirect } from "next/navigation";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  subscriptions,
  sources,
  rawSignals,
  painClusters,
  opportunities,
  jobRuns,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ApiButton } from "@/components/actions";
import { SourceConfigForm } from "@/components/source-config-form";
import {
  billingMetrics,
  recentSubscriptionHistory,
} from "@/lib/billing-history";
import {
  billingReconciliationHealth,
  recentBillingReconciliationErrors,
} from "@/lib/billing-reconciliation";
export const dynamic = "force-dynamic";
export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/app");
  const [
    userCount,
    signalCount,
    clusterCount,
    opportunityCount,
    subs,
    sourceRows,
    jobs,
    recentUsers,
    cost,
    publicationSummary,
    publicationErrors,
    billing,
    billingHistory,
    reconciliationHealth,
    reconciliationErrors,
    maintenance,
    invoiceHealth,
    invoiceErrors,
  ] = await Promise.all([
    db().$count(users),
    db().$count(rawSignals),
    db().$count(painClusters),
    db().$count(opportunities),
    db()
      .select()
      .from(subscriptions)
      .orderBy(desc(subscriptions.updatedAt))
      .limit(30),
    db().select().from(sources),
    db().select().from(jobRuns).orderBy(desc(jobRuns.createdAt)).limit(20),
    db()
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(30),
    db().execute(
      sql`select coalesce(sum(cost_micros),0) as cost, count(*) filter(where cost_micros is null) as unpriced from ai_usage where created_at>=date_trunc('day',now())`,
    ),
    db().execute(
      sql`select status,count(*) as count from publication_jobs group by status`,
    ),
    db().execute(
      sql`select id,kind,day,status,last_error from publication_jobs where last_error is not null order by updated_at desc limit 10`,
    ),
    billingMetrics(),
    recentSubscriptionHistory(),
    billingReconciliationHealth(),
    recentBillingReconciliationErrors(),
    maintenanceStatus(),
    invoiceReconciliationHealth(),
    recentInvoiceReconciliationErrors(),
  ]);
  const mrr = Number(billing.catalog_mrr);
  return (
    <AppShell user={session.user.email} admin configured>
      <div className="page-title">
        <div>
          <div className="eyebrow">OPERATIONS</div>
          <h1>Administration</h1>
          <p>Actual stored counts. Catalog estimates are explicitly labeled.</p>
        </div>
        <ApiButton
          endpoint="/api/admin/collect"
          label="Run collection pipeline"
        />
      </div>
      <div className="metrics">
        {[
          ["Users", userCount],
          ["Active paid accounts", Number(billing.active_accounts)],
          ["Scheduled cancellations", Number(billing.scheduled_cancellations)],
          ["Observed status losses (30d)", Number(billing.observed_losses)],
          [
            "Observed status churn (30d)",
            billing.churn_percent == null
              ? "Not enough history"
              : Number(billing.churn_percent).toFixed(2) + "%",
          ],
          ["Catalog MRR estimate", "$" + mrr],
          ["Catalog ARR estimate", "$" + mrr * 12],
          ["Stored signal identities", signalCount],
          ["Pain clusters", clusterCount],
          ["Opportunities", opportunityCount],
          [
            "AI cost today",
            Number(cost.rows[0]?.unpriced) > 0
              ? "Unknown"
              : "$" + (Number(cost.rows[0]?.cost) / 1e6).toFixed(4),
          ],
        ].map(([k, v]) => (
          <div className="metric" key={k}>
            <div className="metric-label">{k}</div>
            <div className="metric-value">{v}</div>
          </div>
        ))}
      </div>
      <div className="notice">
        MRR/ARR above use active plan catalog prices, excluding discounts, tax,
        currencies, and proration. They are estimates, not verified recognized
        revenue. Source API costs are unknown.
      </div>
      <div className="notice">
        Subscription tracking since{" "}
        {new Date(String(billing.tracking_since)).toISOString().slice(0, 10)}{" "}
        (UTC). Status churn counts accounts active on a known paid plan at the
        start of the 30-day window that were observed leaving that paid-active
        state during it, once per account. Trials are excluded; scheduled
        cancellation alone is not a loss. Reactivation does not remove a gross
        loss. The rate is unavailable until a full 30-day window is tracked and
        its opening cohort is nonempty. This is an observed status metric, not
        verified revenue churn.
      </div>
      <section className="panel detail-block">
        <h2>Data maintenance</h2>
        {maintenance.error ? (
          <p role="alert">{maintenance.error}</p>
        ) : (
          <>
            <p>
              Automatic cleanup:{" "}
              {maintenance.policy?.enabled ? "enabled, hourly" : "disabled"}.{" "}
              {maintenance.retired} signal payloads cleared.
            </p>
            <p>
              Unlinked, processed signals older than{" "}
              {maintenance.policy?.signalDays} days; AI cache older than{" "}
              {maintenance.policy?.cacheDays} days; completed/failed job logs
              older than {maintenance.policy?.logDays} days.
            </p>
            <p>
              Up to 500 items per category per run. Evidence attached to cards,
              saved opportunities, billing and historical snapshots are
              preserved. Signal identifiers remain to prevent recollection.
              Clearance is permanent.
            </p>
            <ApiButton
              endpoint="/api/admin/maintenance"
              payload={{ preview: true }}
              label="Preview eligible cleanup"
            />
            {maintenance.policy?.enabled && (
              <ApiButton
                endpoint="/api/admin/maintenance"
                payload={{ preview: false }}
                label="Run bounded cleanup"
              />
            )}
            {maintenance.runs.length ? (
              maintenance.runs.map((r, i) => (
                <div className="report-row" key={i}>
                  <span>
                    {r.result.preview ? "Preview" : "Cleanup"} ·{" "}
                    {new Date(String(r.result.observedAt))
                      .toISOString()
                      .slice(0, 19)}{" "}
                    UTC
                  </span>
                  <span>
                    Signals{" "}
                    {String(
                      r.result.preview
                        ? r.result.signalsEligible
                        : r.result.signalsRetired,
                    )}{" "}
                    · cache{" "}
                    {String(
                      r.result.preview
                        ? r.result.cacheEligible
                        : r.result.cacheDeleted,
                    )}{" "}
                    · logs{" "}
                    {String(
                      r.result.preview
                        ? r.result.logsEligible
                        : r.result.logsDeleted,
                    )}
                    {r.result.signalsMore ||
                    r.result.cacheMore ||
                    r.result.logsMore
                      ? " · more eligible"
                      : ""}
                  </span>
                </div>
              ))
            ) : (
              <p>No maintenance runs yet.</p>
            )}
          </>
        )}
      </section>
      <div className="detail-grid">
        <div>
          <section className="panel detail-block">
            <h2>Source & crawler health</h2>
            {sourceRows.map((s) => (
              <div className="report-row" key={s.id}>
                <div>
                  {s.name}
                  <p className="text-small">
                    {s.enabled ? "Enabled" : "Disabled"} · {s.health} ·{" "}
                    {s.lastError || "No recorded error"}
                  </p>
                  <p className="text-small">
                    Completed through:{" "}
                    {s.lastCollectedAt?.toISOString() || "Never"}
                  </p>
                  {s.collectionState && (
                    <p className="text-small">
                      Window: {s.collectionState.since} –{" "}
                      {s.collectionState.until}
                      <br />
                      {s.collectionState.pages} pages persisted · Next scope{" "}
                      {s.collectionState.cursor.scope + 1}, page{" "}
                      {s.collectionState.cursor.page}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </section>
          <section className="panel detail-block">
            <h2>Publication queue</h2>
            <p className="text-small">
              {publicationSummary.rows
                .map((r) => String(r.status) + ": " + String(r.count))
                .join(" · ") || "No publications queued"}
            </p>
            {publicationErrors.rows.map((r) => (
              <p className="text-small wrap" key={String(r.id)}>
                {String(r.kind)} · {String(r.day).slice(0, 10)} ·{" "}
                {String(r.status)} · {String(r.last_error)}
              </p>
            ))}
            <h2>Job runs</h2>
            {jobs.length ? (
              jobs.map((j) => (
                <div className="report-row" key={j.id}>
                  <div>
                    {j.job}
                    <p className="text-small wrap">{j.error || j.id}</p>
                  </div>
                  <span className="badge">{j.status}</span>
                </div>
              ))
            ) : (
              <p>No job runs yet.</p>
            )}
          </section>
          <section className="panel detail-block">
            <h2>Recent users</h2>
            {recentUsers.map((u) => (
              <p className="text-small wrap" key={u.id}>
                {u.email} · {u.role} · {u.createdAt.toISOString().slice(0, 10)}
              </p>
            ))}
          </section>
          <section className="panel detail-block">
            <h2>Recently updated subscriptions</h2>
            {subs.map((s) => (
              <p className="text-small wrap" key={s.id}>
                {s.userId} · {s.plan} · {s.status}
              </p>
            ))}
          </section>
          <section className="panel detail-block">
            <h2>Stripe reconciliation</h2>
            <p className="text-small">
              {String(reconciliationHealth.tracked)} known customers ·{" "}
              {String(reconciliationHealth.never)} never reconciled ·{" "}
              {String(reconciliationHealth.due)} due ·{" "}
              {String(reconciliationHealth.errors)} errors
            </p>
            <p className="text-small wrap">
              Oldest successful reconciliation:{" "}
              {reconciliationHealth.oldest_success
                ? String(reconciliationHealth.oldest_success) + " (UTC)"
                : "None"}
            </p>
            <p className="text-small">
              Checks up to 10 accounts every five minutes. Successful accounts
              are checked again after six hours; large queues may take longer.
            </p>
            {reconciliationErrors.map((s) => (
              <p className="text-small wrap" key={String(s.user_id)}>
                {String(s.user_id)} · {String(s.reconciliation_error)} ·
                failures: {String(s.reconciliation_failures)} · retry at{" "}
                {String(s.next_at)} (UTC)
              </p>
            ))}
          </section>
          <section className="panel detail-block">
            <h2>Invoice recovery</h2>
            <p className="text-small">
              {String(invoiceHealth.tracked)} known customers ·{" "}
              {String(invoiceHealth.never)} no completed scan ·{" "}
              {String(invoiceHealth.continuing)} continuing ·{" "}
              {String(invoiceHealth.due)} due · {String(invoiceHealth.errors)}{" "}
              errors
            </p>
            <p className="text-small wrap">
              Oldest completed scan:{" "}
              {invoiceHealth.oldest_success
                ? String(invoiceHealth.oldest_success) + " (UTC)"
                : "None"}
            </p>
            <p className="text-small">
              Up to 10 customer pages every five minutes, 10 invoices per page.
              Full scans repeat after six hours; larger histories and queues
              take longer. Each invoice is freshly retrieved.
            </p>
            {invoiceErrors.map((row) => (
              <p className="text-small wrap" key={String(row.customer_id)}>
                {String(row.customer_id)} · {String(row.error)} · failures:{" "}
                {String(row.failures)} · retry at {String(row.next_at)} (UTC)
              </p>
            ))}
          </section>
          <section className="panel detail-block">
            <h2>Recent subscription observations</h2>
            {billingHistory.length ? (
              billingHistory.map((h) => (
                <div className="report-row" key={String(h.id)}>
                  <div>
                    <p className="text-small wrap">
                      {String(h.user_id)} · {String(h.plan)} ·{" "}
                      {String(h.status)}
                    </p>
                    <p className="text-small wrap">
                      {String(h.event_type)} · {String(h.observed_at)} (observed
                      UTC)
                    </p>
                  </div>
                  <span className="badge">
                    {String(h.transition)}
                    {h.applied ? "" : " · ignored"}
                  </span>
                </div>
              ))
            ) : (
              <p>No subscription observations yet.</p>
            )}
          </section>
        </div>
        <section className="panel detail-block">
          <h2>Configure source</h2>
          <p className="text-small">
            Only public sources. Reddit requires authorized API credentials.
            GitHub uses explicit repository scopes.
          </p>
          <SourceConfigForm />
        </section>
      </div>
    </AppShell>
  );
}
