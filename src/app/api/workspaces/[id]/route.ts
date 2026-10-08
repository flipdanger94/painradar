import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { endpoint, requireUser, input, rateLimit, audit } from "@/lib/security";
import { requireWorkspace } from "@/lib/tenancy";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async (req) => {
    const { id } = await params;
    const u = await requireUser();
    await rateLimit(u.id);
    await requireWorkspace(id, u.id, "admin");
    const d = await input(
      req,
      z.object({
        name: z.string().trim().min(2).max(80),
        clientName: z.string().trim().min(2).max(100),
        brandName: z.string().trim().min(2).max(100),
        brandColor: z.string().regex(/^#[a-fA-F0-9]{6}$/),
      }),
    );
    await db().execute(
      sql`update workspaces set name=${d.name},client_name=${d.clientName},brand_name=${d.brandName},brand_color=${d.brandColor} where id=${id}::uuid and workspace_role(id,${u.id})='admin'`,
    );
    await audit(u.id, "workspace.updated", { workspaceId: id });
    return Response.json({ ok: true });
  })(req);
}
