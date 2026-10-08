/** Checkout/Portal URLs can use Stripe custom domains; require an absolute HTTPS URL. */
export function billingRedirectUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 8192) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
