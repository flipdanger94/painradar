import { Text } from "@/components/language-provider";
import { PublicShell } from "@/components/public-shell";
import { plans } from "@/lib/plans";
import { BillingButton } from "@/components/billing-button";
export default function Page() {
  return (
    <PublicShell>
      <main className="content-page">
        <div className="eyebrow">
          <Text value={"LESS GUESSWORK AT EVERY STAGE"} />
        </div>
        <h1>
          <Text value={"Invest in the right problem."} />
        </h1>
        <p>
          <Text value={"Start free. Go deeper when you find your direction."} />
        </p>
        <div className="pricing-grid">
          {Object.entries(plans).map(([key, p]) => (
            <article
              className={`price-card ${key === "pro" ? "featured" : ""}`}
              key={key}
            >
              <h3>{p.name}</h3>
              <div className="price">
                ${p.price}
                <span>
                  {" "}
                  / <Text value="per month" />
                </span>
              </div>
              <BillingButton plan={key} />
              <ul>
                {p.features.map((f) => (
                  <li key={f}>
                    <Text value={f} />
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="text-small section-rule">
          Prices in USD. Paid checkout requires configured Stripe prices.
          Subscription changes and cancellation are managed through the Stripe
          billing portal. Agency access follows the team owner’s active
          subscription.
        </p>
      </main>
    </PublicShell>
  );
}
