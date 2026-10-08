import { Text } from "@/components/language-provider";
import { PublicShell } from "@/components/public-shell";
import { VerifyForm } from "@/components/verify-form";
export default function Page() {
  return (
    <PublicShell>
      <main className="auth-wrap">
        <h1>
          <Text value={"Verify your email."} />
        </h1>
        <p>Request a new link if your original one has expired.</p>
        <VerifyForm />
      </main>
    </PublicShell>
  );
}
