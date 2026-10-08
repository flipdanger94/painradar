import { sql } from "drizzle-orm";
import { db } from "@/db";
import { userPlan, ApiError } from "./security";
import { plans } from "./plans";
export async function openOpportunity(userId: string, opportunityId: string) {
  const plan = await userPlan(userId);
  if (plan !== "free") return plan;
  const day = new Date().toISOString().slice(0, 10);
  const result = await db().execute(
    sql`select consume_opportunity_open(${userId},${opportunityId}::uuid,${day}::date,${plans.free.opens}) as allowed`,
  );
  if (!result.rows[0]?.allowed)
    throw new ApiError(
      403,
      "Your five daily opportunity opens are used. Upgrade for unlimited access.",
    );
  return plan;
}
