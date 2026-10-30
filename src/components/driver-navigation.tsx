"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { LocateFixed, Navigation, Pause, Play, Map } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import {
  DEMO_ORIGIN,
  illustrativeRoute,
  interpolateRoute,
  validPoint,
  type Point,
} from "@/lib/domain/navigation";
import type { NavigationGate } from "./navigation-map";
const MapView = dynamic(() => import("./navigation-map"), { ssr: false });

export function DriverNavigation({
  locale,
  gates,
  gateId,
  status,
}: {
  locale: Locale;
  gates: NavigationGate[];
  gateId: string | null;
  status: string;
}) {
  const [mode, setMode] = useState<"idle" | "gps" | "demo">("idle");
  const [position, setPosition] = useState<Point>(DEMO_ORIGIN);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [tiles, setTiles] = useState(false);
  const watch = useRef<number | null>(null);
  const progress = useRef(0);
  const origin = useRef<Point>(DEMO_ORIGIN);
  const previousGate = useRef(gateId);
  const destination = gates.find((g) => g.id === gateId);
  const pointReady =
    destination && validPoint(destination.latitude, destination.longitude);
  const terminal = !["planned", "in_transit"].includes(status);
  const activeMode = terminal ? "idle" : mode;
  // GPS remains browser-local. Hide, stop, arrival and unmount all release its watcher.
  useEffect(() => {
    if (activeMode !== "gps") return;
    if (!navigator.geolocation) return;
    let live = true;
    watch.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (!live || !validPoint(coords.latitude, coords.longitude)) return;
        setPosition({ lat: coords.latitude, lng: coords.longitude });
        setAccuracy(coords.accuracy);
        setMessage("gpsActive");
      },
      (error) => {
        if (!live) return;
        setMessage("locationError");
        // A temporary unavailable/timeout fix must not end an authorized watcher.
        // Permission denial is terminal; ignore any queued fixes immediately.
        if (error.code === 1) {
          live = false;
          setMode("idle");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => {
      live = false;
      if (watch.current !== null)
        navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
    };
  }, [activeMode]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        setMode("idle");
        setMessage("trackingPaused");
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  useEffect(() => {
    if (previousGate.current !== gateId) {
      previousGate.current = gateId;
      origin.current = position;
      progress.current = 0;
    }
    if (
      activeMode !== "demo" ||
      !destination ||
      !validPoint(destination.latitude, destination.longitude)
    )
      return;
    const path = illustrativeRoute(origin.current, {
      lat: destination.latitude!,
      lng: destination.longitude!,
    });
    const timer = window.setInterval(() => {
      progress.current = Math.min(1, progress.current + 0.008);
      setPosition(interpolateRoute(path, progress.current));
      if (progress.current >= 1) {
        setMode("idle");
        setMessage("demoDestinationReached");
      }
    }, 400);
    return () => window.clearInterval(timer);
    // The origin is intentionally captured when a run starts or the assigned gate changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode, gateId, destination?.latitude, destination?.longitude]);
  function startGps() {
    if (!navigator.geolocation) {
      setMessage("locationError");
      return;
    }
    setMessage("working");
    setMode("gps");
  }
  function startDemo() {
    if (progress.current >= 1 || mode !== "demo") {
      origin.current = DEMO_ORIGIN;
      progress.current = 0;
      setPosition(DEMO_ORIGIN);
    }
    setAccuracy(null);
    setMessage("demoNavigationActive");
    setMode("demo");
  }
  return (
    <section
      className="panel driver-navigation"
      aria-labelledby="navigation-title"
    >
      <div className="navigation-heading">
        <div>
          <h2 id="navigation-title">
            <Navigation size={22} aria-hidden /> {t(locale, "journeyMap")}
          </h2>
          <p>{t(locale, "approximateRoute")}</p>
        </div>
        <span className="badge">
          {t(locale, activeMode === "gps" ? "gpsActive" : "simulated")}
        </span>
      </div>
      <div className="navigation-destination" aria-live="polite">
        <span>{t(locale, "currentGate")}</span>
        <strong>{destination?.code ?? t(locale, "unavailable")}</strong>
        <span>
          {destination?.eligible_operations
            .map((o) => t(locale, o))
            .join(" / ")}
        </span>
        <small>{t(locale, "routeFollowsGate")}</small>
      </div>
      <MapView
        locale={locale}
        gates={gates}
        destination={destination}
        position={position}
        tiles={tiles}
      />
      <div className="navigation-controls">
        <button
          type="button"
          className="button primary"
          onClick={startGps}
          disabled={terminal || activeMode === "gps"}
        >
          <LocateFixed size={18} aria-hidden /> {t(locale, "enableGps")}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={startDemo}
          disabled={terminal || !pointReady || activeMode === "demo"}
        >
          <Play size={18} aria-hidden /> {t(locale, "runDemoRoute")}
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setMode("idle");
            setMessage("trackingPaused");
          }}
          disabled={activeMode === "idle"}
        >
          <Pause size={18} aria-hidden /> {t(locale, "stopTracking")}
        </button>
        <button
          type="button"
          className="button secondary"
          aria-pressed={tiles}
          onClick={() => setTiles((v) => !v)}
        >
          <Map size={18} aria-hidden /> {t(locale, "toggleBaseMap")}
        </button>
      </div>
      <p role="status">
        {terminal
          ? t(locale, "trackingEnded")
          : message
            ? t(locale, message)
            : t(locale, "navigationPrivacy")}
        {accuracy !== null && activeMode === "gps"
          ? ` · ${t(locale, "accuracy")}: ${Math.ceil(accuracy).toLocaleString(locale)} ${t(locale, "meters")}`
          : ""}
      </p>
      {!pointReady ? (
        <p className="notice">{t(locale, "mapUnconfigured")}</p>
      ) : null}
      <p className="calculation-note">{t(locale, "navigationPrivacy")}</p>
    </section>
  );
}
