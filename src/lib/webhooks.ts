import { request } from "node:https";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  decryptSecret,
  resolveWebhook,
  webhookSignature,
} from "./webhook-security";
export const webhookEvents = [
  "new_opportunity",
  "score_increase",
  "mentions_spike",
  "trend_acceleration",
  "new_competitor",
  "report_ready",
] as const;
export async function queueWebhook(
  workspaceId: string,
  type: string,
  data: Record<string, unknown>,
  eventKey: string,
) {
  const payload = { type, workspaceId, data };
  await db().execute(
    sql`insert into webhook_deliveries(webhook_id,event_key,payload) select id,${eventKey},${JSON.stringify(payload)}::jsonb from outbound_webhooks where workspace_id=${workspaceId}::uuid and enabled and events ? ${type} on conflict(webhook_id,event_key) do nothing`,
  );
}
export async function postWebhook(
  url: string,
  secret: string,
  id: string,
  payload: Record<string, unknown>,
) {
  const target = await resolveWebhook(url);
  const body = JSON.stringify({ id, ...payload });
  const timestamp = String(Math.floor(Date.now() / 1000));
  return new Promise<number>((resolve, reject) => {
    const req = request(
      target.url,
      {
        method: "POST",
        family: target.address.family,
        lookup: (_hostname, options, callback) => {
          const cb = callback as (...args: unknown[]) => void;
          if (options.all) cb(null, [target.address]);
          else cb(null, target.address.address, target.address.family);
        },
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "X-PainRadar-Delivery": id,
          "X-PainRadar-Signature": webhookSignature(secret, timestamp, body),
        },
        timeout: 10000,
      },
      (res) => {
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > 65536) req.destroy(new Error("Response too large"));
        });
        res.on("end", () => resolve(res.statusCode || 0));
        res.on("error", reject);
      },
    );
    const deadline = setTimeout(
      () => req.destroy(new Error("Webhook deadline exceeded")),
      10000,
    );
    req.on("close", () => clearTimeout(deadline));
    req.on("timeout", () => req.destroy(new Error("Webhook timeout")));
    req.on("error", reject);
    req.end(body);
  });
}
export async function deliverWebhooks() {
  if (!process.env.WEBHOOK_ENCRYPTION_KEY)
    return { processed: 0, configured: false };
  await db().execute(
    sql`update webhook_deliveries set status='failed',last_error='Delivery attempts exhausted',lease_until=null where status in ('pending','sending') and attempts>=6 and (lease_until is null or lease_until<now())`,
  );
  const claimed = await db().execute(
    sql`select * from claim_webhook_deliveries(10)`,
  );
  for (const row of claimed.rows) {
    let status = 0,
      error: string | null = null;
    try {
      const allowed = await db().execute(
        sql`select h.id from outbound_webhooks h join workspaces w on w.id=h.workspace_id join teams t on t.id=w.team_id where h.id=${String(row.webhook_id)}::uuid and h.enabled and agency_active(t.owner_id)`,
      );
      if (!allowed.rows.length)
        throw new Error("Webhook disabled or Agency access inactive");
      status = await postWebhook(
        String(row.url),
        decryptSecret(String(row.secret_ciphertext)),
        String(row.id),
        row.payload as Record<string, unknown>,
      );
      if (status < 200 || status >= 300) error = "HTTP " + status;
    } catch {
      error = "Delivery failed (network, destination policy, or configuration)";
    }
    const attempts = Number(row.attempts);
    const success = error === null;
    const state = success ? "delivered" : attempts >= 6 ? "failed" : "pending";
    const next = new Date(
      Date.now() + Math.min(3600, 60 * 2 ** (attempts - 1)) * 1000,
    );
    await db().execute(
      sql`update webhook_deliveries set status=${state},last_status=${status || null},last_error=${error},next_attempt_at=${next.toISOString()}::timestamptz,lease_until=null,delivered_at=${success ? new Date().toISOString() : null}::timestamptz where id=${String(row.id)}::uuid and status='sending' and attempts=${attempts}`,
    );
  }
  return { processed: claimed.rows.length, configured: true };
}
