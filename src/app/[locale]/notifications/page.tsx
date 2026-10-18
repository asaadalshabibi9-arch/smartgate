import Link from "next/link";
import { Bell } from "lucide-react";
import { requireIdentity } from "@/lib/auth";
import { localeOf, t, dateTime } from "@/lib/i18n";
import { Shell, PageHeading, Badge } from "@/components/workspace";
import { Refresh } from "@/components/refresh";
export default async function Notifications({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = localeOf((await params).locale);
  const { db, profile } = await requireIdentity(locale);
  const { data, error } = await db
    .from("notifications")
    .select("*, trips(request_number)")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Notifications unavailable");
  return (
    <Shell locale={locale} profile={profile} section="notifications">
      <PageHeading
        locale={locale}
        title={t(locale, "notifications")}
        hint={t(locale, "notificationsHint")}
      >
        <Refresh locale={locale} />
      </PageHeading>
      <section className="panel">
        {data.length ? (
          data.map((n) => (
            <article className="notification" key={n.id}>
              <Bell size={20} aria-hidden />
              <div>
                <Link
                  className="text-link"
                  href={`/${locale}/trips/${n.trip_id}`}
                >
                  {t(locale, n.purpose)}
                  {n.trips?.request_number ? (
                    <>
                      {" "}
                      · <bdi>{n.trips.request_number}</bdi>
                    </>
                  ) : null}
                </Link>
                <small>
                  {dateTime(locale, n.created_at)} · {t(locale, "simulated")}
                </small>
              </div>
              <Badge locale={locale} status={n.status} />
            </article>
          ))
        ) : (
          <div className="empty">
            <Bell size={30} aria-hidden />
            <p>{t(locale, "noNotifications")}</p>
          </div>
        )}
      </section>
    </Shell>
  );
}
