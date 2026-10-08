import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ApiError } from "./security";
const policySchema = z.object({
  enabled: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  signalDays: z.coerce.number().int().min(30).max(3650).default(90),
  cacheDays: z.coerce.number().int().min(7).max(365).default(30),
  logDays: z.coerce.number().int().min(30).max(3650).default(90),
});
export function maintenancePolicy() {
  const value = policySchema.safeParse({
    enabled: process.env.DATA_MAINTENANCE_ENABLED,
    signalDays: process.env.SIGNAL_PAYLOAD_RETENTION_DAYS,
    cacheDays: process.env.AI_CACHE_RETENTION_DAYS,
    logDays: process.env.JOB_LOG_RETENTION_DAYS,
  });
  if (!value.success)
    throw new ApiError(503, "Invalid data maintenance configuration");
  return value.data;
}
export async function runMaintenance(
  id: string,
  preview = true,
  policy = maintenancePolicy(),
) {
  z.uuid().parse(id);
  // Revalidate the frozen policy supplied by a durable job step.
  const checked = policySchema.parse({
    ...policy,
    enabled: String(policy.enabled),
  });
  if (!preview && (!checked.enabled || !maintenancePolicy().enabled))
    throw new ApiError(409, "Enable DATA_MAINTENANCE_ENABLED to run cleanup");
  const result = await db().execute(
    sql`select run_data_maintenance(${id}::uuid,${checked.signalDays},${checked.cacheDays},${checked.logDays},${preview}) as result`,
  );
  return result.rows[0].result as Record<string, unknown>;
}
export async function maintenanceStatus() {
  let policy;
  try {
    policy = maintenancePolicy();
  } catch {
    return {
      error: "Invalid data maintenance configuration",
      policy: null,
      retired: 0,
      runs: [] as { result: Record<string, unknown> }[],
    };
  }
  const [signals, runs] = await Promise.all([
    db().execute(
      sql`select count(*) as count from raw_signals where retired_at is not null`,
    ),
    db().execute(
      sql`select result from maintenance_runs order by created_at desc,id desc limit 5`,
    ),
  ]);
  return {
    error: null,
    policy,
    retired: Number(signals.rows[0].count),
    runs: runs.rows as { result: Record<string, unknown> }[],
  };
}
