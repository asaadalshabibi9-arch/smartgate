import type { Metadata } from "next";
import "./globals.css";
import { headers } from "next/headers";
import { Cairo } from "next/font/google";
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-cairo",
});

export async function generateMetadata(): Promise<Metadata> {
  const english = (await headers()).get("x-smartgate-locale") === "en";
  return {
    title: english
      ? "SmartGate | Entry workspace"
      : "SmartGate | البوابة الذكية",
    description: english
      ? "Demo workspace for port entry journeys"
      : "نموذج تجريبي لتنظيم دخول الشاحنات إلى الميناء",
    icons: { icon: "/brand/favicon.svg", apple: "/brand/apple-touch-icon.png" },
    manifest: "/brand/site.webmanifest",
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = (await headers()).get("x-smartgate-locale");
  const lang = locale === "en" ? "en" : "ar";
  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <body className={cairo.variable}>{children}</body>
    </html>
  );
}
