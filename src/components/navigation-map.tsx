"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { t, type Locale } from "@/lib/i18n";
import {
  validPoint,
  illustrativeRoute,
  type Point,
} from "@/lib/domain/navigation";
export type NavigationGate = {
  id: string;
  code: string;
  latitude: number | null;
  longitude: number | null;
  eligible_operations: string[];
  status: string;
};

export default function NavigationMap({
  locale,
  gates,
  destination,
  position,
  tiles,
}: {
  locale: Locale;
  gates: NavigationGate[];
  destination: NavigationGate | undefined;
  position: Point;
  tiles: boolean;
}) {
  const element = useRef<HTMLDivElement>(null);
  const instance = useRef<Leaflet.Map | null>(null);
  const layers = useRef<Leaflet.LayerGroup | null>(null);
  const base = useRef<Leaflet.TileLayer | null>(null);
  const library = useRef<typeof Leaflet | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    import("leaflet")
      .then((L) => {
        if (!alive || !element.current) return;
        library.current = L;
        instance.current = L.map(element.current, {
          center: [19.672, 57.7],
          zoom: 13,
          scrollWheelZoom: false,
        });
        layers.current = L.layerGroup().addTo(instance.current);
        setReady(true);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      instance.current?.remove();
      instance.current = null;
    };
  }, []);
  useEffect(() => {
    const L = library.current,
      map = instance.current,
      group = layers.current;
    if (!ready || !L || !map || !group) return;
    group.clearLayers();
    for (const gate of gates) {
      if (!validPoint(gate.latitude, gate.longitude)) continue;
      L.circleMarker([gate.latitude!, gate.longitude!], {
        radius: gate.id === destination?.id ? 11 : 7,
        color: "#142d4e",
        fillColor: ["open", "busy"].includes(gate.status)
          ? "#087f8c"
          : "#a94b50",
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip(
          `${gate.code} · ${gate.eligible_operations.map((o) => t(locale, o)).join(" / ")}`,
          { direction: "top" },
        )
        .addTo(group);
    }
    L.circleMarker([position.lat, position.lng], {
      radius: 9,
      color: "white",
      weight: 4,
      fillColor: "#2687f5",
      fillOpacity: 1,
    })
      .bindTooltip(t(locale, "driverPosition"))
      .addTo(group);
    if (
      destination &&
      validPoint(destination.latitude, destination.longitude)
    ) {
      const route = illustrativeRoute(position, {
        lat: destination.latitude!,
        lng: destination.longitude!,
      });
      L.polyline(
        route.map((p) => [p.lat, p.lng] as [number, number]),
        { color: "#087f8c", weight: 5, dashArray: "9 7" },
      ).addTo(group);
      map.fitBounds(
        L.latLngBounds(route.map((p) => [p.lat, p.lng] as [number, number])),
        { padding: [40, 45], maxZoom: 14, animate: false },
      );
    } else map.setView([position.lat, position.lng], 13, { animate: false });
  }, [ready, gates, destination, position, locale]);
  useEffect(() => {
    if (!ready || !instance.current || !library.current) return;
    if (tiles && !base.current)
      base.current = library.current
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        })
        .addTo(instance.current);
    if (!tiles && base.current) {
      base.current.remove();
      base.current = null;
    }
  }, [tiles, ready]);
  return (
    <div
      className="driver-map"
      ref={element}
      role="region"
      aria-label={t(locale, "journeyMap")}
    >
      {failed ? <p role="alert">{t(locale, "mapLoadError")}</p> : null}
    </div>
  );
}
