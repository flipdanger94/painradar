import { request } from "node:https";
import { resolveWebhook } from "../webhook-security";
import { createGunzip, createInflate, createBrotliDecompress } from "node:zlib";
export async function publicFetch(
  value: string,
  redirects = 0,
): Promise<{
  text: string;
  headers: import("node:http").IncomingHttpHeaders;
  url: string;
}> {
  // Pin the resolved public address. Every redirect gets its own DNS validation.
  const target = await resolveWebhook(value);
  return new Promise((resolve, reject) => {
    const req = request(
      target.url,
      {
        method: "GET",
        family: target.address.family,
        lookup: (_host, options, callback) => {
          const cb = callback as (...args: unknown[]) => void;
          if (options.all) cb(null, [target.address]);
          else cb(null, target.address.address, target.address.family);
        },
        headers: {
          "User-Agent":
            process.env.SOURCE_USER_AGENT ||
            "PainRadar/0.1 (public market research)",
          Accept:
            "application/json, application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9",
        },
      },
      (res) => {
        const status = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          res.resume();
          if (!res.headers.location || redirects >= 3) {
            reject(new Error("Source redirect limit reached"));
            return;
          }
          let next: string;
          try {
            next = new URL(res.headers.location, target.url).toString();
          } catch {
            reject(new Error("Invalid source redirect"));
            return;
          }
          publicFetch(next, redirects + 1).then(resolve, reject);
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`Source returned ${status}`));
          return;
        }
        let received = 0;
        res.on("data", (chunk) => {
          received += chunk.length;
          if (received > 2_000_000)
            req.destroy(new Error("Source response too large"));
        });
        const encoding = res.headers["content-encoding"];
        const stream =
          encoding === "gzip"
            ? res.pipe(createGunzip())
            : encoding === "deflate"
              ? res.pipe(createInflate())
              : encoding === "br"
                ? res.pipe(createBrotliDecompress())
                : res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk) => {
          size += chunk.length;
          if (size > 2_000_000) {
            stream.destroy();
            req.destroy(new Error("Source response too large"));
            return;
          }
          chunks.push(Buffer.from(chunk));
        });
        stream.on("error", reject);
        res.on("error", reject);
        stream.on("end", () =>
          resolve({
            text: Buffer.concat(chunks).toString("utf8"),
            headers: res.headers,
            url: target.url.toString(),
          }),
        );
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("Source request timed out")),
      20000,
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end();
  });
}
export async function publicJson(value: string) {
  const r = await publicFetch(value);
  return { data: JSON.parse(r.text), headers: r.headers, url: r.url };
}
