import { ApiButton } from "@/components/actions";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <section className="panel detail-block">
      <h1>Join an agency team</h1>
      <p>
        This invitation must match your account’s verified email. The owner must
        have an active Agency subscription.
      </p>
      <ApiButton
        endpoint="/api/invites/accept"
        payload={{ token }}
        label="Accept invitation"
      />
      <p>
        <a className="text-link" href="/app/teams">
          Open your teams →
        </a>
      </p>
    </section>
  );
}
