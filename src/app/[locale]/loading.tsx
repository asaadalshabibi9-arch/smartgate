"use client";
import { useParams } from "next/navigation";
import { localeOf, t } from "@/lib/i18n";
export default function Loading() {
  const params = useParams();
  return (
    <main className="loading-screen" role="status" aria-busy="true">
      <div className="spinner" />
      <p>{t(localeOf(String(params.locale)), "loading")}</p>
    </main>
  );
}
