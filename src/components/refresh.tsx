"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
export function Refresh({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="refresh"
      disabled={pending}
      onClick={() => start(() => router.refresh())}
    >
      <RefreshCw size={15} aria-hidden />
      {t(locale, pending ? "working" : "refresh")}
    </button>
  );
}
