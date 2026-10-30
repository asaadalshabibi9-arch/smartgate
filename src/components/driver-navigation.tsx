"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  LocateFixed,
  Pause,
  Play,
  Navigation,
} from "lucide-react";
import { t, dateTime, type Locale } from "@/lib/i18n";
import { googleNavigationUrl, type SharedLocation } from "@/lib/tracking";
import { validPoint } from "@/lib/domain/navigation";
type Destination = {
  id: string;
  code: string;
  latitude: number | null;
  longitude: number | null;
};
export function DriverNavigation({
  locale,
  tripId,
  destination,
  status,
  lastLocation,
}: {
  locale: Locale;
  tripId: string;
  destination: Destination | undefined;
  status: string;
  lastLocation: SharedLocation | null;
}) {
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState<"idle" | "starting" | "gps" | "simulation">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [observedAt, setObservedAt] = useState<string | null>(
    lastLocation?.observed_at ?? null,
  );
  const [near, setNear] = useState(false);
  const [changed, setChanged] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const session = useRef<string | null>(null);
  const watch = useRef<number | null>(null);
  const inflight = useRef(false);
  const lastSent = useRef(0);
  const queued = useRef<{
    lat: number;
    lng: number;
    accuracy: number;
    session: string;
  } | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousGate = useRef(destination?.id);
  const active = status === "in_transit";
  const googleUrl = googleNavigationUrl(
    destination?.latitude ?? null,
    destination?.longitude ?? null,
  );
  const send = useCallback(
    async (action: string, id: string, input: Record<string, unknown> = {}) => {
      const response = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: tripId,
          session_id: id,
          action,
          ...input,
        }),
        keepalive: action === "stop",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "actionError");
      return body.data as { observed_at?: string; approaching?: boolean };
    },
    [tripId],
  );
  const stop = useCallback(
    (silent = false) => {
      const id = session.current;
      session.current = null;
      queued.current = null;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      retryTimer.current = null;
      if (watch.current !== null) {
        navigator.geolocation?.clearWatch(watch.current);
        watch.current = null;
      }
      if (id) void send("stop", id).catch(() => {});
      if (!silent) {
        setMode("idle");
        setMessage("sharingPausedHint");
        setNear(false);
      }
    },
    [send],
  );
  useEffect(() => {
    const hide = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      stop(true);
    };
  }, [stop]);
  useEffect(() => {
    if (!active) stop();
  }, [active, stop]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    setNow(Date.now());
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (previousGate.current !== destination?.id) {
      previousGate.current = destination?.id;
      setChanged(true);
    }
  }, [destination?.id]);
  const publish = useCallback(
    async function publishFix(
      lat: number,
      lng: number,
      accuracy: number,
      force = false,
    ): Promise<void> {
      const id = session.current;
      if (!id || !validPoint(lat, lng)) return;
      if (
        inflight.current ||
        (!force && Date.now() - lastSent.current < 5000)
      ) {
        queued.current = { lat, lng, accuracy, session: id };
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(
          () => {
            const fix = queued.current;
            queued.current = null;
            if (fix && session.current === fix.session)
              void publishFix(fix.lat, fix.lng, fix.accuracy, true);
          },
          Math.max(300, 5000 - (Date.now() - lastSent.current)),
        );
        return;
      }
      inflight.current = true;
      lastSent.current = Date.now();
      try {
        const result = await send("position", id, {
          latitude: lat,
          longitude: lng,
          accuracy_m: Math.min(100000, Math.max(0, accuracy)),
        });
        if (session.current !== id) return;
        setObservedAt(result.observed_at ?? null);
        setNear(result.approaching ?? false);
        setMessage(
          result.approaching ? "nearReassessment" : "sharedLocationLive",
        );
      } catch {
        if (session.current === id) setMessage("sharingError");
      } finally {
        inflight.current = false;
      }
    },
    [send],
  );
  useEffect(() => {
    if (mode !== "gps" || !session.current || !active) return;
    if (!navigator.geolocation) {
      setMessage("locationError");
      stop();
      return;
    }
    const id = session.current;
    watch.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (session.current === id && !document.hidden)
          void publish(coords.latitude, coords.longitude, coords.accuracy);
      },
      (error) => {
        if (session.current !== id) return;
        if (error.code === 1) {
          stop();
          setMessage("locationError");
        } else setMessage("locationError");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => {
      if (watch.current !== null) {
        navigator.geolocation.clearWatch(watch.current);
        watch.current = null;
      }
    };
  }, [mode, active, publish, stop]);
  async function start(source: "gps" | "simulation") {
    if (!consent || !active) return;
    stop(true);
    const id = crypto.randomUUID();
    session.current = id;
    setMode("starting");
    setMessage("working");
    setObservedAt(null);
    setNear(false);
    lastSent.current = 0;
    try {
      await send("start", id, { source });
      if (session.current !== id) {
        void send("stop", id).catch(() => {});
        return;
      }
      setMode(source);
      setMessage("awaitingPosition");
      if (source === "simulation") await publish(19.6, 57.6, 5, true);
    } catch {
      if (session.current === id) {
        session.current = null;
        setMode("idle");
        setMessage("sharingError");
      }
    }
  }
  const displayedAt =
    mode === "idle" ? (lastLocation?.observed_at ?? observedAt) : observedAt;
  const fresh =
    active &&
    ["gps", "simulation"].includes(mode) &&
    observedAt &&
    now !== null &&
    now - Date.parse(observedAt) <= 90000;
  return (
    <section
      className="panel driver-navigation"
      aria-labelledby="navigation-title"
    >
      <div className="navigation-heading">
        <div>
          <h2 id="navigation-title">
            <Navigation size={22} aria-hidden />
            {t(locale, "openGoogleMaps")}
          </h2>
          <p>{t(locale, "googleExternalHint")}</p>
        </div>
      </div>
      <div className="navigation-destination" aria-live="polite">
        <span>{t(locale, "currentGate")}</span>
        <strong>{destination?.code ?? t(locale, "unavailable")}</strong>
        <small>{t(locale, "googleDestinationHint")}</small>
      </div>
      {changed ? (
        <p className="notice" role="status">
          {t(locale, "gateDestinationChanged")}
        </p>
      ) : null}
      {googleUrl ? (
        <a
          className="button primary google-navigation"
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink size={19} aria-hidden />
          {t(locale, "openGoogleMaps")}
        </a>
      ) : (
        <p className="notice">{t(locale, "mapUnconfigured")}</p>
      )}
      <label className="sharing-consent">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            if (!e.target.checked) stop();
          }}
        />
        <span>{t(locale, "shareLocationConsent")}</span>
      </label>
      <div className="navigation-controls">
        <button
          type="button"
          className="button secondary"
          onClick={() => void start("gps")}
          disabled={
            !active || !consent || mode === "gps" || mode === "starting"
          }
        >
          <LocateFixed size={18} aria-hidden />
          {t(locale, "startSharing")}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => void start("simulation")}
          disabled={
            !active || !consent || mode === "simulation" || mode === "starting"
          }
        >
          <Play size={18} aria-hidden />
          {t(locale, "runDemoRoute")}
        </button>
        {mode === "simulation" &&
        destination &&
        validPoint(destination.latitude, destination.longitude) ? (
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              void publish(
                destination.latitude! - 0.01,
                destination.longitude! - 0.01,
                5,
                true,
              )
            }
          >
            {t(locale, "simulateApproach")}
          </button>
        ) : null}
        <button
          type="button"
          className="button secondary"
          onClick={() => stop()}
          disabled={mode === "idle"}
        >
          <Pause size={18} aria-hidden />
          {t(locale, "stopTracking")}
        </button>
      </div>
      <div className="tracking-state">
        <span className="badge">
          {t(
            locale,
            mode === "simulation"
              ? "simulated"
              : fresh
                ? "sharedLocationLive"
                : "lastKnownLocation",
          )}
        </span>
        <time>
          {t(locale, "updated")}: {dateTime(locale, displayedAt)}
        </time>
      </div>
      <p role="status">
        {!active
          ? t(locale, "trackingEnded")
          : message
            ? t(locale, message)
            : t(locale, "sharingPausedHint")}
      </p>
      {near ? <p className="notice">{t(locale, "nearReassessment")}</p> : null}
    </section>
  );
}
