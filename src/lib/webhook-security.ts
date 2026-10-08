import ipaddr from "ipaddr.js";
import { lookup } from "node:dns/promises";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
export function webhookUrl(value: string) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    (u.port && u.port !== "443") ||
    u.username ||
    u.password ||
    u.hash ||
    ipaddr.isValid(u.hostname) ||
    u.hostname.includes(":") ||
    !u.hostname.includes(".") ||
    /\.(localhost|local|internal|test|invalid|example)$/i.test(u.hostname)
  )
    throw new Error(
      "Use a public HTTPS hostname on port 443 without credentials or fragments",
    );
  return u;
}
export function publicAddress(address: string) {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}
export async function resolveWebhook(value: string) {
  const url = webhookUrl(value);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("DNS timeout")), 5000);
    }),
  ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new Error(
      "Webhook DNS must resolve only to public unicast addresses",
    );
  return { url, address: addresses[0] };
}
function encryptionKey() {
  const key = Buffer.from(process.env.WEBHOOK_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32)
    throw new Error(
      "WEBHOOK_ENCRYPTION_KEY must contain 32 random bytes in base64",
    );
  return key;
}
export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  return Buffer.concat([
    iv,
    cipher.update(secret, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
export function decryptSecret(value: string) {
  const data = Buffer.from(value, "base64");
  if (data.length < 29) throw new Error("Invalid encrypted secret");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    data.subarray(0, 12),
  );
  decipher.setAuthTag(data.subarray(-16));
  return Buffer.concat([
    decipher.update(data.subarray(12, -16)),
    decipher.final(),
  ]).toString("utf8");
}
export function webhookSignature(
  secret: string,
  timestamp: string,
  body: string,
) {
  return (
    "t=" +
    timestamp +
    ",v1=" +
    createHmac("sha256", secret)
      .update(timestamp + "." + body)
      .digest("hex")
  );
}
