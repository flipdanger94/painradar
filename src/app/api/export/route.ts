import {
  endpoint,
  requireUser,
  userPlan,
  ApiError,
  rateLimit,
} from "@/lib/security";
import { listOpportunities } from "@/lib/queries";
import { csvCell } from "@/lib/csv";
export const GET = endpoint(async () => {
  const u = await requireUser();
  await rateLimit(u.id);
  if ((await userPlan(u.id)) === "free")
    throw new ApiError(403, "Pro plan required for exports");
  const rows = await listOpportunities({}, 500);
  const fields = [
    "title",
    "industry",
    "score",
    "mentions",
    "growth7d",
    "confidence",
  ] as const;
  const csv = [
    fields.join(","),
    ...rows.map((r) => fields.map((k) => csvCell(r[k])).join(",")),
  ].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="painradar-opportunities.csv"',
    },
  });
});
