"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

type Point = { lat: number; lng: number; weight?: number };

/** Gauteng-ish centre + zoom; works for whole-province view. */
const DEFAULT_CENTER: [number, number] = [-26.1, 28.05];
const DEFAULT_ZOOM = 9;

/** Re-fits the map whenever `focus` changes (e.g. a suburb is clicked). */
function FocusController({ focus }: { focus?: Point[] }) {
  const map = useMap();
  useEffect(() => {
    if (!focus || focus.length === 0) return;
    const bounds = L.latLngBounds(focus.map((p) => [p.lat, p.lng] as [number, number]));
    if (bounds.isValid()) {
      // A tighter zoom for a single suburb; pad a little so pins aren't on the edge.
      // animate:false avoids Leaflet's zoom-transition setTimeout, which throws
      // "Cannot read properties of undefined (reading '_leaflet_pos')" when the map
      // is torn down (admin tab switch) or re-focused before the animation ends.
      try {
        map.fitBounds(bounds.pad(0.4), { maxZoom: 15, animate: false });
      } catch {
        /* map was removed mid-update — ignore */
      }
    }
  }, [focus, map]);
  return null;
}

function HeatLayer({ points }: { points: Point[] }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    // leaflet.heat extends L with .heatLayer(); type isn't on L by default
    const heat = (
      L as unknown as {
        heatLayer: (
          points: Array<[number, number, number?]>,
          options?: Record<string, unknown>,
        ) => L.Layer;
      }
    ).heatLayer(
      points.map((p) => [p.lat, p.lng, p.weight ?? 0.6] as [number, number, number]),
      {
        radius: 28,
        blur: 22,
        maxZoom: 14,
        gradient: {
          0.2: "#5d7a47",
          0.4: "#e9a96b",
          0.7: "#d97742",
          1.0: "#a93226",
        },
      },
    );
    heat.addTo(map);

    // Fit map to all points (with a small pad). animate:false for the same reason
    // as FocusController — no zoom-transition timeout to crash on teardown.
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    if (bounds.isValid()) {
      try {
        map.fitBounds(bounds.pad(0.2), { maxZoom: 12, animate: false });
      } catch {
        /* ignore */
      }
    }

    return () => {
      try {
        heat.remove();
      } catch {
        /* map already gone */
      }
    };
  }, [points, map]);

  return null;
}

export default function HeatMap({
  points,
  focus,
  height = 480,
}: {
  points: Point[];
  /** When provided, the map zooms to fit just these points (suburb drill-down). */
  focus?: Point[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full rounded-2xl overflow-hidden border border-[var(--color-line)]">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <HeatLayer points={points} />
        <FocusController focus={focus} />
      </MapContainer>
    </div>
  );
}
