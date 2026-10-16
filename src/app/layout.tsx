import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartGate | البوابة الذكية",
  description: "منصة لتنظيم دخول الشاحنات إلى الميناء",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
