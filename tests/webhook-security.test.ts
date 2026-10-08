import { describe, it, expect, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  webhookUrl,
  publicAddress,
  encryptSecret,
  decryptSecret,
  webhookSignature,
} from "@/lib/webhook-security";
import { brandedReport } from "@/lib/branded-report";
const previous = process.env.WEBHOOK_ENCRYPTION_KEY;
afterEach(() => {
  if (previous === undefined) delete process.env.WEBHOOK_ENCRYPTION_KEY;
  else process.env.WEBHOOK_ENCRYPTION_KEY = previous;
});
describe("Outbound destination and signing security", () => {
  it("rejects credentials, IP literals, private names, HTTP, fragments and alternate ports", () => {
    for (const url of [
      "http://hooks.example.org",
      "https://127.0.0.1/x",
      "https://[::1]/x",
      "https://localhost/x",
      "https://foo.internal/x",
      "https://a:b@hooks.example.org/x",
      "https://hooks.example.org:444/x",
      "https://hooks.example.org/x#fragment",
    ])
      expect(() => webhookUrl(url)).toThrow();
    expect(webhookUrl("https://hooks.example.org/path").hostname).toBe(
      "hooks.example.org",
    );
  });
  it("rejects private, reserved and IPv4-mapped private DNS results", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "192.0.2.1",
      "::1",
      "fe80::1",
      "fc00::1",
      "::ffff:10.0.0.1",
    ])
      expect(publicAddress(ip), ip).toBe(false);
    expect(publicAddress("1.1.1.1")).toBe(true);
    expect(publicAddress("2606:4700:4700::1111")).toBe(true);
  });
  it("authenticates encrypted secrets and rejects tampering or missing key", () => {
    process.env.WEBHOOK_ENCRYPTION_KEY = Buffer.alloc(32, 17).toString(
      "base64",
    );
    const encrypted = encryptSecret("test-secret");
    expect(decryptSecret(encrypted)).toBe("test-secret");
    const bytes = Buffer.from(encrypted, "base64");
    bytes[15] ^= 1;
    expect(() => decryptSecret(bytes.toString("base64"))).toThrow();
    delete process.env.WEBHOOK_ENCRYPTION_KEY;
    expect(() => encryptSecret("test-secret")).toThrow();
  });
  it("signs the exact timestamp and raw JSON body", () => {
    const body = '{"id":"test","type":"report_ready"}';
    const digest = createHmac("sha256", "test-secret")
      .update("1700000000." + body)
      .digest("hex");
    expect(webhookSignature("test-secret", "1700000000", body)).toBe(
      "t=1700000000,v1=" + digest,
    );
    expect(
      webhookSignature("test-secret", "1700000000", body + " "),
    ).not.toContain(digest);
  });
  it("escapes report data and rejects CSS injection", () => {
    const html = brandedReport(
      {
        name: "<script>alert(1)</script>",
        client: '<img onerror="x">',
        color: "red;}</style><script>x</script>",
      },
      {
        period: "daily",
        startDay: "2026-10-01",
        endDay: "2026-10-02",
        content: [
          {
            title: "<script>x</script>",
            summary: "<img src=x>",
            score: 70,
            mentions: 5,
          },
        ],
      },
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("color:#555555");
  });
});
