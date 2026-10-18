"use client";
import { useParams } from "next/navigation";
import { localeOf, t } from "@/lib/i18n";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const params = useParams();
  const locale = localeOf(String(params.locale));
  return (
    <main className="error-page">
      <h1>{t(locale, "errorTitle")}</h1>
      <p>{t(locale, "actionError")}</p>
      <button className="button primary" onClick={reset}>
        {t(locale, "retry")}
      </button>
    </main>
  );
}
