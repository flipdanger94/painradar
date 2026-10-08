import { PublicShell } from "@/components/public-shell";
import { AuthForm } from "@/components/auth-form";
export default function Page() {
  return (
    <PublicShell>
      <AuthForm
        mode="forgot"
        google={Boolean(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
        )}
        github={Boolean(
          process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
        )}
      />
    </PublicShell>
  );
}
