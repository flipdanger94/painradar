import { and, eq, gt, desc } from "drizzle-orm";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { auth, getSession } from "@/lib/auth";
import { ApiError, endpoint, input, rateLimit } from "@/lib/security";
import { z } from "zod";

async function accountSession() {
  const session = await getSession();
  if (!session) throw new ApiError(401, "Log in to manage your sessions.");
  return session;
}

export const GET = endpoint(async () => {
  const current = await accountSession();
  const active = await db()
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      userAgent: sessions.userAgent,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, current.user.id),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(sessions.createdAt))
    .limit(100);
  return Response.json(
    {
      sessions: active.map((session) => ({
        ...session,
        current: session.id === current.session.id,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});

export const DELETE = endpoint(async (req) => {
  const current = await accountSession();
  await rateLimit("session-revoke:" + current.user.id);
  const body = await input(
    req,
    z.object({ id: z.string().min(1).max(128) }).strict(),
  );
  if (body.id === current.session.id)
    throw new ApiError(400, "Use Log out to end your current session.");
  const [target] = await db()
    .select({ token: sessions.token })
    .from(sessions)
    .where(and(eq(sessions.id, body.id), eq(sessions.userId, current.user.id)))
    .limit(1);
  if (!target) throw new ApiError(404, "Session not found.");
  await auth().api.revokeSession({
    headers: req.headers,
    body: { token: target.token },
  });
  return Response.json({ ok: true });
});
