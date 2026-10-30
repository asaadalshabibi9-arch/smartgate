import { localeOf, t } from "@/lib/i18n";
import { loadTrip } from "@/lib/trip-data";
import { Shell, PageHeading } from "@/components/workspace";
import {
  TripNotice,
  TripIdentity,
  Timeline,
  TripQR,
  Recommendation,
  TripControls,
  ReportLink,
} from "@/components/trip-detail";
import { DriverNavigation } from "@/components/driver-navigation";
import { TrackingView } from "@/components/tracking-view";
import { isApproaching } from "@/lib/tracking";
import { Refresh } from "@/components/refresh";
export default async function TripPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale: raw, id } = await params;
  const locale = localeOf(raw);
  const data = await loadTrip(locale, id);
  const { profile, trip, report, events, gates, location } = data;
  const assignedGate = gates.find((g) => g.id === trip.gate_id);
  return (
    <Shell locale={locale} profile={profile}>
      <PageHeading
        locale={locale}
        title={trip.request_number}
        hint={t(locale, "tripDetail")}
      >
        <Refresh locale={locale} />
      </PageHeading>
      <TripNotice locale={locale} trip={trip} />
      <TripIdentity
        locale={locale}
        trip={trip}
        report={report}
        gate={gates.find((g) => g.id === trip.gate_id)}
      />
      {["planned", "in_transit"].includes(trip.status) ? (
        <Recommendation
          locale={locale}
          trip={trip}
          gates={gates}
          canAccept={profile.role === "driver" && trip.status === "in_transit"}
          approaching={isApproaching(location, assignedGate)}
        />
      ) : null}
      {profile.role === "driver" ? (
        <DriverNavigation
          locale={locale}
          key={trip.id}
          tripId={trip.id}
          destination={assignedGate}
          lastLocation={location}
          status={trip.status}
        />
      ) : null}
      {profile.role !== "driver" ? (
        <TrackingView
          locale={locale}
          locations={location ? [location] : []}
          trips={[trip]}
          gates={gates}
        />
      ) : null}
      <div className="split-panel">
        <TripControls
          locale={locale}
          trip={trip}
          profile={profile}
          report={report}
        />
        <TripQR locale={locale} trip={trip} />
      </div>
      <Timeline locale={locale} events={events} gates={gates} />
      <ReportLink locale={locale} trip={trip} />
    </Shell>
  );
}
