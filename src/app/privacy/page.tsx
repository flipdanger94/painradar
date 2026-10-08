import { PublicShell } from "@/components/public-shell";
export default function Page() {
  return (
    <PublicShell>
      <main className="content-page legal">
        <h1>Privacy notice</h1>
        <div className="notice">
          Pre-launch document — operator details required before public release.
        </div>
        <p>
          PainRadar stores account details, session data, saved opportunities,
          radar settings, billing identifiers, and usage records. Public-source
          signals include public author handles and links. Password
          authentication and OAuth are handled by Better Auth; payments are
          handled by Stripe. Configured AI providers receive public signal text
          for analysis. Analytics are opt-in. Do not submit private or sensitive
          information. This pre-launch notice must be completed with the
          operating entity, contact address, retention periods, and deletion
          procedure before accepting public customers.
        </p>
      </main>
    </PublicShell>
  );
}
