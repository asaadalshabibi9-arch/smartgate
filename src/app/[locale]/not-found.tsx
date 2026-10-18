"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { localeOf, t } from "@/lib/i18n";
export default function NotFound() {
  const locale = localeOf(String(useParams().locale));
  return (
    <main className="error-page">
      <h1>{t(locale, "notFound")}</h1>
      <Link className="button primary" href={`/${locale}`}>
        {t(locale, "back")}
      </Link>
    </main>
  );
}
