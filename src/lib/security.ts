import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { z } from "zod";
import { getSession } from "./auth";
import { db } from "@/db";
import { subscriptions, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { plans, type Plan } from "./plans";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function requireUser() {
  const session = await getSession();
  if (!session) throw new ApiError(401, "Log in to continue.");
  return session.user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin")
    throw new ApiError(403, "Administrator access required.");
  return user;
}
export async function userPlan(userId: string): Promise<Plan> {
  const row = (
    await db()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
  )[0];
  return row &&
    ["active", "trialing"].includes(row.status) &&
    (!row.currentPeriodEnd || row.currentPeriodEnd.getTime() > Date.now()) &&
    row.plan in plans
    ? (row.plan as Plan)
    : "free";
}
export function assertOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const expected =
    process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL;
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(expected || "").origin;
  } catch {
    throw new ApiError(
      503,
      "Application address has not been configured correctly.",
    );
  }
  if (req.headers.get("origin") !== expectedOrigin)
    throw new ApiError(403, "Request origin is not allowed.");
}
let limiter: Ratelimit | undefined;
export async function rateLimit(key: string) {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    if (process.env.NODE_ENV === "production")
      throw new ApiError(503, "Rate limiting is not configured.");
    return;
  }
  limiter ??= new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "painradar:api",
  });
  const r = await limiter.limit(key);
  if (!r.success)
    throw new ApiError(429, "Too many requests. Please try again shortly.");
}
export async function input<T extends z.ZodType>(req: Request, schema: T) {
  if (Number(req.headers.get("content-length")) > 20000)
    throw new ApiError(413, "Request is too large.");
  let data: unknown;
  try {
    const text = await req.text();
    if (text.length > 20000) throw new ApiError(413, "Request is too large.");
    data = JSON.parse(text);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "Invalid JSON.");
  }
  const r = schema.safeParse(data);
  if (!r.success)
    throw new ApiError(400, r.error.issues.map((i) => i.message).join("; "));
  return r.data as z.infer<T>;
}
export async function audit(
  userId: string,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  await db().insert(auditLogs).values({ userId, action, metadata });
}
export function endpoint(
  handler: (req: Request) => Promise<Response>,
  options: { origin?: boolean } = {},
) {
  return async (req: Request) => {
    try {
      if (options.origin !== false) assertOrigin(req);
      return await handler(req);
    } catch (e) {
      if (e instanceof ApiError)
        return Response.json({ error: e.message }, { status: e.status });
      console.error(
        "api_error",
        e instanceof Error ? e.message : "Unknown error",
      );
      return Response.json(
        { error: "The request could not be completed. Please try again." },
        { status: 503 },
      );
    }
  };
}
