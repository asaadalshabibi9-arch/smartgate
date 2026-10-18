"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { t, type Locale } from "@/lib/i18n";

// A15/FR15: events only invalidate data. Server loaders re-authorize every refresh.
// No client event payload is used as trip state or as proof of an action.
export function LiveUpdates({
  locale,
  profileId,
}: {
  locale: Locale;
  profileId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState("liveConnecting");
  useEffect(() => {
    const db = createClient();
    let disposed = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    function refresh() {
      if (disposed || document.hidden || !navigator.onLine || debounce) return;
      debounce = setTimeout(() => {
        debounce = undefined;
        if (!disposed) startTransition(() => router.refresh());
      }, 400);
    }
    const channel = db.channel(`workspace-${profileId}-${crypto.randomUUID()}`);
    for (const table of ["trips", "trip_events", "gates", "notifications"]) {
      for (const event of ["INSERT", "UPDATE"] as const)
        channel.on(
          "postgres_changes",
          { event, schema: "public", table },
          refresh,
        );
    }
    channel.subscribe((state) => {
      if (disposed) return;
      setStatus(
        !navigator.onLine
          ? "liveOffline"
          : state === "SUBSCRIBED"
            ? "liveConnected"
            : state === "CHANNEL_ERROR" ||
                state === "TIMED_OUT" ||
                state === "CLOSED"
              ? "liveFallback"
              : "liveConnecting",
      );
    });
    const online = () => {
      setStatus("liveConnecting");
      refresh();
    };
    const offline = () => setStatus("liveOffline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", refresh);
    // Covers disconnections, deletes and publication provisioning; never runs hidden/offline.
    const fallback = setInterval(refresh, 20_000);
    return () => {
      disposed = true;
      clearInterval(fallback);
      clearTimeout(debounce);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", refresh);
      void db.removeChannel(channel);
    };
  }, [profileId, router, startTransition]);
  return (
    <span className="live-status" role="status" aria-live="polite">
      {t(locale, status)}
    </span>
  );
}
