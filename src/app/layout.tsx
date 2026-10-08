import { cookies, headers } from "next/headers";
import { LanguageProvider } from "@/components/language-provider";
import { validLocale } from "@/lib/i18n/messages";
import { Analytics } from "@/components/analytics";
import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  title: {
    default: "PainRadar — Find problems worth building",
    template: "%s · PainRadar",
  },
  description:
    "Evidence-first market intelligence. Discover growing problems from public conversations, validate demand, and build with conviction.",
  openGraph: {
    title: "PainRadar — Find problems worth building",
    description: "Evidence first. AI second.",
    type: "website",
  },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  const locale = validLocale(
    jar.get("painradar-locale")?.value ||
      (await headers()).get("accept-language")?.split(",")[0].split("-")[0],
  );
  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body>
        <LanguageProvider key={locale} initialLocale={locale}>
          {children}
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
