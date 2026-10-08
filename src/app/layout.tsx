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
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
