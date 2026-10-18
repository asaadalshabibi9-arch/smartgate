"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";
import type { Locale } from "@/lib/i18n";
export function LanguageSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const other = locale === "ar" ? "en" : "ar";
  const path = pathname.replace(/^\/(ar|en)(?=\/|$)/, `/${other}`);
  // Full navigation updates document direction while retaining the trip and query.
  return (
    <a
      className="language"
      href={`${path}${search.size ? `?${search}` : ""}`}
      hrefLang={other}
      lang={other}
    >
      <Languages size={17} aria-hidden />
      {other === "en" ? "English" : "العربية"}
    </a>
  );
}
