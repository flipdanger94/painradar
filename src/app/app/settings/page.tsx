import { Text } from "@/components/language-provider";

import { formatStripeInvoiceAmount } from "@/lib/stripe-amount";
import { TrackEvent } from "@/components/track-event";
import { eq, desc, and, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, invoices, subscriptions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { BillingButton } from "@/components/billing-button";
import { ApiKeyForm } from "@/components/api-key-form";
import { ApiButton } from "@/components/actions";
import { EmptyState } from "@/components/empty-state";
import { AccountSettings } from "@/components/account-settings";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const billing = (await searchParams).billing;
  const s = await getSession();
  if (!s)
    return (
      <>
        <div className="page-title">
          <h1>
            <Text value={"Settings & billing"} />
          </h1>
        </div>
        <EmptyState
          title="Your account settings"
          description="Log in to manage your account, subscription, and API access."
          action={{ href: "/login", label: "Log in" }}
        />
      </>
    );
  const sub = (
    await db()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, s.user.id))
  )[0];
  const keys = await db()
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, s.user.id), isNull(apiKeys.workspaceId)));
  const bills = sub?.customerId
    ? await db()
        .select()
        .from(invoices)
        .where(eq(invoices.customerId, sub.customerId))
        .orderBy(
          desc(
            sql`coalesce(${invoices.providerCreatedAt},${invoices.createdAt})`,
          ),
          desc(invoices.id),
        )
        .limit(20)
    : [];
  return (
    <>
      {billing === "success" &&
        sub &&
        ["active", "trialing"].includes(sub.status) && (
          <TrackEvent
            event="subscription_started"
            properties={{ plan: sub.plan, subscriptionId: sub.subscriptionId }}
          />
        )}
      <div className="page-title">
        <div>
          <h1>
            <Text value={"Settings & billing"} />
          </h1>
          <p>Your account, subscription, and API access.</p>
        </div>
      </div>
      <AccountSettings
        name={s.user.name}
        email={s.user.email}
        verified={s.user.emailVerified}
      />
      <div className="settings-grid">
        <section className="panel detail-block">
          <h2>
            <Text value={"Subscription"} />
          </h2>
          <p>
            {sub?.plan || "Free"} · {sub?.status || "No paid subscription"}
          </p>
          {sub?.cancelAtPeriodEnd && (
            <p>Cancellation scheduled at the current period end.</p>
          )}
          <BillingButton portal />
        </section>
        <section className="panel detail-block">
          <h2>
            <Text value={"API keys"} />
          </h2>
          <p className="text-small">
            Founder subscription required. Keys are stored as SHA-256 hashes and
            displayed only once.
          </p>
          <ApiKeyForm />
          {keys.map((k) => (
            <div className="report-row" key={k.id}>
              <div>
                {k.name}
                <p className="text-small">
                  {k.prefix}… {k.revokedAt ? "Revoked" : ""}
                </p>
              </div>
              {!k.revokedAt && (
                <ApiButton
                  endpoint="/api/keys"
                  method="DELETE"
                  payload={{ id: k.id }}
                  label="Revoke"
                />
              )}
            </div>
          ))}
        </section>
      </div>
      <section className="panel detail-block">
        <h2>
          <Text value={"Invoices"} />
        </h2>
        {bills.length ? (
          bills.map((i) => (
            <div className="report-row" key={i.id}>
              <span>
                Paid amount:{" "}
                {formatStripeInvoiceAmount(i.amountPaid, i.currency)} ·{" "}
                {i.status || "Unknown status"}
                {i.providerCreatedAt && (
                  <>
                    {" "}
                    · Issued {i.providerCreatedAt.toISOString().slice(0, 10)}
                  </>
                )}
                {i.observedAt && (
                  <span className="text-small">
                    {" "}
                    · Synced {i.observedAt.toISOString().slice(0, 10)}
                  </span>
                )}
              </span>
              {i.url && (
                <a
                  className="text-link"
                  href={i.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open invoice ↗
                </a>
              )}
            </div>
          ))
        ) : (
          <p>No invoices synced yet.</p>
        )}
      </section>
    </>
  );
}
