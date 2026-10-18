import type { Metadata } from "next";
import "./globals.css";
import { headers } from "next/headers";
import {
  Cairo,
  Noto_Sans_Devanagari,
  Noto_Sans_Bengali,
  Noto_Sans_Malayalam,
  Noto_Sans_Tamil,
  Noto_Naskh_Arabic,
} from "next/font/google";
import { localeOf, direction, t } from "@/lib/i18n";
const cairo = Cairo({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-cairo",
});
const devanagari = Noto_Sans_Devanagari({
  display: "swap",
  preload: false,
  variable: "--font-cairo",
});
const bengali = Noto_Sans_Bengali({
  display: "swap",
  preload: false,
  variable: "--font-cairo",
});
const malayalam = Noto_Sans_Malayalam({
  display: "swap",
  preload: false,
  variable: "--font-cairo",
});
const tamil = Noto_Sans_Tamil({
  display: "swap",
  preload: false,
  variable: "--font-cairo",
});
const urdu = Noto_Naskh_Arabic({
  display: "swap",
  preload: false,
  variable: "--font-cairo",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = localeOf((await headers()).get("x-smartgate-locale") ?? "ar");
  return {
    title: `SmartGate | ${t(locale, "entryJourneys")}`,
    description: t(locale, "demo"),
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
  const lang = localeOf(locale ?? "ar");
  const font = {
    ar: cairo,
    en: cairo,
    hi: devanagari,
    ne: devanagari,
    bn: bengali,
    ml: malayalam,
    ta: tamil,
    ur: urdu,
  }[lang];
  return (
    <html lang={lang} dir={direction(lang)}>
      <body className={font.variable}>{children}</body>
    </html>
  );
}
