"use client";
import { Printer } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
export function PrintReport({ locale }: { locale: Locale }) {
  return (
    <button
      type="button"
      className="button no-print"
      onClick={() => window.print()}
    >
      <Printer size={18} aria-hidden />
      {t(locale, "printReport")}
    </button>
  );
}
