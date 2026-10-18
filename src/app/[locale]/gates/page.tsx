import { requireIdentity } from "@/lib/auth";
import { localeOf, t, dateTime } from "@/lib/i18n";
import { Shell, PageHeading } from "@/components/workspace";
import { Refresh } from "@/components/refresh";
import { GateCards } from "@/components/gates";
import { LocationMap } from "@/components/location-map";
export default async function Gates({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = localeOf((await params).locale);
  const { db, profile } = await requireIdentity(locale);
  const { data, error } = await db.from("gates").select("*").order("code");
  if (error) throw new Error("Gate query failed");
  const audit =
    profile.role === "demo_admin"
      ? await db
          .from("gate_events")
          .select("*")
          .order("occurred_at", { ascending: false })
          .limit(20)
      : null;
  if (audit?.error) throw new Error("Gate audit query failed");
  return (
    <Shell locale={locale} profile={profile} section="gates">
      <PageHeading
        locale={locale}
        title={t(locale, "gates")}
        hint={t(locale, "gateHint")}
      >
        <Refresh locale={locale} />
      </PageHeading>
      <GateCards
        locale={locale}
        gates={data}
        editable={profile.role === "demo_admin"}
      />
      <LocationMap locale={locale} gates={data} />
      {audit?.data.length ? (
        <section className="panel">
          <h2>{t(locale, "gateAudit")}</h2>
          <ul className="audit-list">
            {audit.data.map((event) => (
              <li key={event.id}>
                <strong>
                  {data.find((g) => g.id === event.gate_id)?.code}
                </strong>{" "}
                · {dateTime(locale, event.occurred_at)} ·{" "}
                {t(locale, "simulated")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Shell>
  );
}
