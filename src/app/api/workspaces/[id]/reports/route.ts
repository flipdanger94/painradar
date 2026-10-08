import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceReports } from "@/db/schema";
import { endpoint, requireUser, rateLimit, ApiError } from "@/lib/security";
import { requireWorkspace } from "@/lib/tenancy";
import { generateWorkspaceReports } from "@/lib/workspace-data";
import { brandedReport } from "@/lib/branded-report";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const { id } = await params;
    const u = await requireUser();
    await rateLimit(u.id);
    await requireWorkspace(id, u.id, "edit");
    await generateWorkspaceReports(id);
    return Response.json({ ok: true });
  })(req);
}
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const { id } = await params;
    const u = await requireUser();
    const w = await requireWorkspace(id, u.id);
    const reportId = z
      .uuid()
      .parse(new URL(req.url).searchParams.get("reportId"));
    const [r] = await db()
      .select()
      .from(workspaceReports)
      .where(
        and(
          eq(workspaceReports.id, reportId),
          eq(workspaceReports.workspaceId, id),
        ),
      );
    if (!r) throw new ApiError(404, "Report not found");
    return new Response(
      brandedReport(
        { name: w.brand_name, color: w.brand_color, client: w.client_name },
        r,
      ),
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="client-report-${r.endDay}.html"`,
          "Cache-Control": "private, no-store",
          "Content-Security-Policy":
            "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  })(req);
}
