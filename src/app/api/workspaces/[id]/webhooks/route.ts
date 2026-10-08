import { z } from "zod";
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireWorkspace } from "@/lib/tenancy";
import {
  endpoint,
  requireUser,
  input,
  rateLimit,
  ApiError,
  audit,
} from "@/lib/security";
import { encryptSecret, resolveWebhook } from "@/lib/webhook-security";
import { webhookEvents } from "@/lib/webhooks";
export async function POST(
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
        url: z.url().max(2048),
      }),
    );
    if (!process.env.WEBHOOK_ENCRYPTION_KEY)
      throw new ApiError(503, "Webhook encryption is not configured");
    try {
      await resolveWebhook(d.url);
    } catch {
      throw new ApiError(
        400,
        "Destination must resolve to a public HTTPS hostname",
      );
    }
    const secret = randomBytes(32).toString("hex");
    const encrypted = encryptSecret(secret);
    const hookId = crypto.randomUUID();
    const r = await db().execute(
      sql`with scope as (select id from teams where id=(select team_id from workspaces where id=${id}::uuid) for update) insert into outbound_webhooks(id,workspace_id,name,url,secret_ciphertext,events,created_by) select ${hookId}::uuid,${id}::uuid,${d.name},${d.url},${encrypted},${JSON.stringify(webhookEvents)}::jsonb,${u.id} from scope where workspace_role(${id}::uuid,${u.id})='admin' and (select count(*) from outbound_webhooks where workspace_id=${id}::uuid and enabled)<10 returning id`,
    );
    if (!r.rows.length)
      throw new ApiError(
        403,
        "Access unavailable or ten enabled webhooks already exist",
      );
    await audit(u.id, "webhook.created", {
      workspaceId: id,
      webhookId: hookId,
    });
    return Response.json({ id: hookId, secret }, { status: 201 });
  })(req);
}
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async (req) => {
    const { id } = await params;
    const u = await requireUser();
    await rateLimit(u.id);
    await requireWorkspace(id, u.id, "admin");
    const { webhookId } = await input(req, z.object({ webhookId: z.uuid() }));
    await db().execute(
      sql`update outbound_webhooks set enabled=false where id=${webhookId}::uuid and workspace_id=${id}::uuid and workspace_role(workspace_id,${u.id})='admin'`,
    );
    await audit(u.id, "webhook.disabled", { workspaceId: id, webhookId });
    return Response.json({ ok: true });
  })(req);
}
