import { PublicShell } from "@/components/public-shell";
export default function Page() {
  return (
    <PublicShell>
      <main className="content-page legal">
        <h1>Pre-launch terms</h1>
        <div className="notice">
          Pre-launch document — operator details required before public release.
        </div>
        <p>
          PainRadar is an evidence-first research tool. Scores, AI
          interpretations, and MVP proposals are not guarantees of demand,
          revenue, or commercial success. Source content belongs to its authors;
          follow original-source policies. Do not use the service to profile
          individuals or collect private information. Billing and cancellation
          are provided through Stripe. This pre-launch policy must be completed
          with the operating entity, jurisdiction, support contact, refund
          terms, and liability provisions before a commercial launch.
        </p>
      </main>
    </PublicShell>
  );
}
