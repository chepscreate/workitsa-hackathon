"use client";

import { useState } from "react";
import Button from "@/components/Button";

type Coords = { lat: number; lng: number; accuracy?: number };

type Props = {
  label?: string;
  hint?: string;
  initial?: Coords | null;
  onChange: (c: Coords) => void;
};

export default function LocationPicker({
  label = "Pin location",
  hint,
  initial,
  onChange,
}: Props) {
  const [coords, setCoords] = useState<Coords | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pin = () => {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("This device doesn't support geolocation.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: Coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setCoords(c);
        onChange(c);
        setBusy(false);
      },
      (err) => {
        setError(err.message);
        setBusy(false);
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15_000 },
    );
  };

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-cream-2)] p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-ink)]">{label}</p>
          {hint && (
            <p className="mt-1 text-xs text-[var(--color-ink-muted)]">{hint}</p>
          )}
          {coords && (
            <p className="mt-2 text-xs text-[var(--color-sage-700)]">
              ✓ Pinned · {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              {coords.accuracy
                ? ` (±${Math.round(coords.accuracy)} m)`
                : ""}
            </p>
          )}
          {error && (
            <p className="mt-2 text-xs text-[var(--color-brick)]">{error}</p>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={pin}
          loading={busy}
          loadingText="Pinning…"
          className="flex-shrink-0"
        >
          {coords ? "Re-pin" : "Use my location"}
        </Button>
      </div>
    </div>
  );
}
