import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users, auditLogs } from "../src/db/schema";
async function main() {
  const email = process.env.ADMIN_EMAIL;
  if (!email)
    throw new Error("Set ADMIN_EMAIL to an existing verified account email");
  const existing = (
    await db().select().from(users).where(eq(users.email, email))
  )[0];
  if (!existing?.emailVerified)
    throw new Error(
      "Verified account not found; register and verify the email first",
    );
  await db()
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.id, existing.id));
  await db()
    .insert(auditLogs)
    .values({ userId: existing.id, action: "admin.granted.cli" });
  console.log("Administrator access granted to the existing verified account");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
