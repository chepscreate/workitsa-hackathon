"use client";

/**
 * Map view for the find-work feed. Plots open jobs (that have a pinned
 * location) as price markers, the worker's home as a "you" marker, and
 * fits the view to show everything. Each marker's popup links to the job.
 *
 * Mirrors the Leaflet setup in LiveMap.tsx (OSM tiles, brand-toned divIcons,
 * no external marker assets). Loaded via `dynamic(..., { ssr: false })` from
 * the page — Leaflet touches `window` at import time.
 */

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import type { Job } from "@/lib/types";

// Gauteng / Johannesburg fallback centre when we have nothing to anchor on.
const JHB = { lat: -26.2041, lng: 28.0473 };

type MapJob = Job & { _distanceKm?: number };

function priceIcon(price: number | undefined, urgent?: boolean) {
  const label = `${urgent ? "🔥 " : ""}R${(price ?? 0).toLocaleString("en-ZA")}`;
  const bg = urgent ? "#A93226" : "#B85A2A";
  // Approximate width so Leaflet's anchor lands the tip on the location.
  const w = 22 + label.length * 8.5;
  return L.divIcon({
    className: "",
    html: `<div style="
      transform:translate(-50%,-100%);
      display:inline-block;white-space:nowrap;
      background:${bg};color:#FAF4EC;font:600 12px/1 system-ui,sans-serif;
      padding:6px 10px;border-radius:999px;border:2px solid #FAF4EC;
      box-shadow:0 3px 8px rgba(0,0,0,0.25);">${label}</div>`,
    iconSize: [w, 26],
    iconAnchor: [0, 0], // we offset via translate above so the tip = location
  });
}

const homeIcon = L.divIcon({
  className: "",
  html: `<div style="
    transform:translate(-50%,-50%);
    width:18px;height:18px;border-radius:50%;
    background:#5D7A47;border:3px solid #FAF4EC;
    box-shadow:0 0 0 4px rgba(93,122,71,0.25);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [0, 0],
});

function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
  }, [points, map]);
  return null;
}

export default function JobsMap({
  jobs,
  home,
}: {
  jobs: MapJob[];
  home: { lat: number; lng: number } | null;
}) {
  const mapped = jobs.filter(
    (j) => typeof j.lat === "number" && typeof j.lng === "number",
  );
  const points = [
    ...mapped.map((j) => ({ lat: j.lat as number, lng: j.lng as number })),
    ...(home ? [home] : []),
  ];
  const center = home ?? (mapped[0]
    ? { lat: mapped[0].lat as number, lng: mapped[0].lng as number }
    : JHB);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={12}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {home && (
        <Marker position={[home.lat, home.lng]} icon={homeIcon}>
          <Popup>You are here</Popup>
        </Marker>
      )}

      {mapped.map((j) => (
        <Marker
          key={j.id}
          position={[j.lat as number, j.lng as number]}
          icon={priceIcon(j.suggestedPrice, j.urgent)}
        >
          <Popup>
            <div style={{ minWidth: 160 }}>
              <strong style={{ display: "block", marginBottom: 2 }}>{j.title}</strong>
              <div style={{ color: "#7A6A5E", fontSize: 12 }}>
                {j.suburb}
                {typeof j._distanceKm === "number" && ` · ${j._distanceKm.toFixed(1)} km away`}
              </div>
              <div style={{ fontSize: 13, margin: "4px 0" }}>
                Suggested: <b>R{(j.suggestedPrice ?? 0).toLocaleString("en-ZA")}</b>
              </div>
              <a
                href={`/jobs?id=${j.id}`}
                style={{ color: "#B85A2A", fontWeight: 600, fontSize: 13 }}
              >
                View job →
              </a>
            </div>
          </Popup>
        </Marker>
      ))}

      <FitBounds points={points} />
    </MapContainer>
  );
}
