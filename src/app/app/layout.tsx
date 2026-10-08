import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth";
import { databaseReady } from "@/db";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (databaseReady() && !session) redirect("/login");
  return (
    <AppShell
      user={session?.user.email || null}
      admin={session?.user.role === "admin"}
      configured={databaseReady()}
    >
      {children}
    </AppShell>
  );
}
