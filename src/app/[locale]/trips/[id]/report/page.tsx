import { localeOf, t, dateTime } from "@/lib/i18n";
import { loadTrip } from "@/lib/trip-data";
import { Shell, PageHeading } from "@/components/workspace";
import { PrintReport } from "@/components/print-report";
import {
  TripIdentity,
  Timeline,
  TripNotice,
  Deliveries,
} from "@/components/trip-detail";
export default async function ReportPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale = localeOf(raw);
  const { trip, profile, report, events, gates } = await loadTrip(locale, id);
  return (
    <Shell locale={locale} profile={profile} section="reports">
      <PageHeading
        locale={locale}
        title={t(
          locale,
          trip.status === "completed" ? "report" : "pendingReport",
        )}
        hint={trip.request_number}
      >
        <PrintReport locale={locale} />
      </PageHeading>
      <TripNotice locale={locale} trip={trip} />
      {trip.status === "completed" ? (
        <section className="panel">
          <dl className="detail-grid">
            <div>
              <dt>{t(locale, "crossed")}</dt>
              <dd>{dateTime(locale, trip.crossed_at)}</dd>
            </div>
            <div>
              <dt>{t(locale, "completedAt")}</dt>
              <dd>{dateTime(locale, trip.completed_at)}</dd>
            </div>
            <div>
              <dt>{t(locale, "source")}</dt>
              <dd>{t(locale, "simulated")}</dd>
            </div>
          </dl>
        </section>
      ) : null}
      <TripIdentity
        locale={locale}
        trip={trip}
        report={report}
        gate={gates.find((g) => g.id === trip.gate_id)}
      />
      <Timeline locale={locale} events={events} gates={gates} />
      {trip.status === "completed" ? (
        <Deliveries locale={locale} notifications={report.notifications} />
      ) : null}
    </Shell>
  );
}
