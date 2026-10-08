import { describe, it, expect } from "vitest";
import { formatStripeInvoiceAmount } from "@/lib/stripe-amount";
describe("Stripe invoice amount display", () => {
  it.each([
    [2900, "usd", "29.00 USD"],
    [101, "eur", "1.01 EUR"],
    [1, "kzt", "0.01 KZT"],
    [500, "jpy", "500 JPY"],
    [2900, "krw", "2900 KRW"],
    [500, "mga", "500 MGA"],
    [500, "isk", "5 ISK"],
    [500, "ugx", "5 UGX"],
    [1045, "huf", "10.45 HUF"],
    [80045, "twd", "800.45 TWD"],
    [501, "isk", "5.01 ISK"],
    [501, "ugx", "5.01 UGX"],
    [0, "usd", "0.00 USD"],
    [0, "jpy", "0 JPY"],
    [2900, "USD", "29.00 USD"],
    [2147483647, "usd", "21474836.47 USD"],
    [Number.MAX_SAFE_INTEGER, "usd", "90071992547409.91 USD"],
  ])("formats %s %s as %s", (amount, currency, expected) => {
    expect(formatStripeInvoiceAmount(amount, currency)).toBe(expected);
  });
  it("does not guess units for unknown or unreviewed three-decimal currencies", () => {
    expect(formatStripeInvoiceAmount(1234, "bhd")).toBe(
      "1234 minor units (BHD)",
    );
    expect(formatStripeInvoiceAmount(1234, "zzz")).toBe(
      "1234 minor units (ZZZ)",
    );
  });
  it("does not display invalid or unsafe stored amounts as payments", () => {
    for (const amount of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])
      expect(formatStripeInvoiceAmount(amount, "usd")).toBe("Unavailable");
    for (const currency of ["", "us", "usd<script>", " usd"])
      expect(formatStripeInvoiceAmount(100, currency)).toBe("Unavailable");
  });
});
