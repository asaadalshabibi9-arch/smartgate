"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, LocateFixed } from "lucide-react";
import { t, dateTime, type Locale } from "@/lib/i18n";
import {
  googlePositionUrl,
  isFreshLocation,
  type SharedLocation,
} from "@/lib/tracking";
export function TrackingView({
  locale,
  locations,
  trips,
  gates,
}: {
  locale: Locale;
  locations: SharedLocation[];
  trips: { id: string; request_number: string; gate_id: string | null }[];
  gates: { id: string; code: string }[];
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  return (
    <section
      className="panel fleet-tracking"
      aria-labelledby="fleet-tracking-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="fleet-tracking-title">
            <LocateFixed size={22} aria-hidden /> {t(locale, "fleetTracking")}
          </h2>
          <p>{t(locale, "fleetTrackingHint")}</p>
        </div>
      </div>
      {locations.length ? (
        <div className="tracking-list">
          {locations.map((location) => {
            const trip = trips.find((trip) => trip.id === location.trip_id);
            const url = googlePositionUrl(
              location.latitude,
              location.longitude,
            );
            const live = now !== null && isFreshLocation(location, now);
            return (
              <article key={location.trip_id} className="tracking-item">
                <div>
                  <Link href={`/${locale}/trips/${location.trip_id}`}>
                    <strong>
                      {trip?.request_number ?? t(locale, "tripDetail")}
                    </strong>
                  </Link>
                  <span>{gates.find((g) => g.id === trip?.gate_id)?.code}</span>
                </div>
                <div>
                  <span className={`badge ${live ? "live-position" : ""}`}>
                    {t(
                      locale,
                      location.source === "simulation"
                        ? "simulated"
                        : live
                          ? "sharedLocationLive"
                          : "lastKnownLocation",
                    )}
                  </span>
                  <small>
                    {t(locale, "updated")}:{" "}
                    {dateTime(locale, location.observed_at)}
                  </small>
                </div>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-link"
                  >
                    {t(locale, "viewInGoogleMaps")}
                    <ExternalLink size={15} aria-hidden />
                  </a>
                ) : (
                  <span>{t(locale, "awaitingPosition")}</span>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="notice">{t(locale, "noSharedLocations")}</p>
      )}
    </section>
  );
}
