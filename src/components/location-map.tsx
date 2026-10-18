"use client";
import { useEffect, useRef, useState } from "react";
import { t, type Locale } from "@/lib/i18n";

type MapGate = {
  id: string;
  code: string;
  latitude: number | null;
  longitude: number | null;
};
export function LocationMap({
  locale,
  gates,
}: {
  locale: Locale;
  gates: MapGate[];
}) {
  const configured = gates.filter(
    (gate) => Number.isFinite(gate.latitude) && Number.isFinite(gate.longitude),
  );
  const [point, setPoint] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
  } | null>(null);
  const [state, setState] = useState<"idle" | "working" | "locationError">(
    "idle",
  );
  const [showMap, setShowMap] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  function locate() {
    setState("working");
    if (!navigator.geolocation) {
      setState("locationError");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!alive.current) return;
        setPoint({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
        });
        setShowMap(false);
        setState("idle");
      },
      () => {
        if (alive.current) setState("locationError");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  }
  const url = point
    ? `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=15/${point.lat}/${point.lng}`
    : "";
  return (
    <section className="panel location-map">
      <h2>{t(locale, "map")}</h2>
      <p className="notice">
        {t(locale, configured.length ? "mapConfiguredHint" : "mapUnconfigured")}
      </p>
      {configured.length ? (
        <label>
          {t(locale, "gate")}
          <select
            defaultValue=""
            onChange={(event) => {
              const gate = configured.find(
                (item) => item.id === event.target.value,
              );
              setPoint(
                gate
                  ? {
                      lat: gate.latitude!,
                      lng: gate.longitude!,
                      accuracy: null,
                    }
                  : null,
              );
              setShowMap(false);
            }}
          >
            <option value="">{t(locale, "choose")}</option>
            {configured.map((gate) => (
              <option key={gate.id} value={gate.id}>
                {gate.code}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <p>{t(locale, "locationHint")}</p>
      <button
        className="button secondary"
        type="button"
        disabled={state === "working"}
        onClick={locate}
      >
        {t(locale, state === "working" ? "working" : "locate")}
      </button>
      <p role="status">
        {state === "locationError"
          ? t(locale, "locationError")
          : point?.accuracy != null
            ? `${t(locale, "accuracy")}: ${Math.ceil(point.accuracy).toLocaleString(locale)}`
            : ""}
      </p>
      {point ? (
        <>
          <button
            type="button"
            className="button secondary"
            onClick={() => setShowMap(true)}
          >
            {t(locale, "map")}
          </button>{" "}
          <a
            className="button secondary"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t(locale, "openMap")}
          </a>
          {showMap ? (
            <iframe
              title={t(locale, "map")}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-popups"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${point.lng - 0.01},${point.lat - 0.01},${point.lng + 0.01},${point.lat + 0.01}&layer=mapnik&marker=${point.lat},${point.lng}`}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}
