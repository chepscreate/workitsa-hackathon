"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  stopSharingLocation,
  updateWorkerLocation,
} from "@/lib/jobs";
import type { Job } from "@/lib/types";

// Leaflet must be loaded only on the client — it touches `window`.
const LiveMap = dynamic(() => import("./LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="h-56 rounded-xl bg-[var(--color-cream-2)] animate-pulse" />
  ),
});

export function WorkerLocationControls({ job }: { job: Job }) {
  const [sharing, setSharing] = useState(!!job.workerLocationSharing);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const start = async () => {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("This device doesn't support geolocation.");
      return;
    }
    setSharing(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await updateWorkerLocation(
            job.id,
            pos.coords.latitude,
            pos.coords.longitude,
          );
        } catch {
          /* ignore single failures */
        }
      },
      (err) => {
        setError(err.message);
        setSharing(false);
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
  };

  const stop = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
    try {
      await stopSharingLocation(job.id);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mt-4 rounded-xl bg-[var(--color-cream-2)] border border-[var(--color-line)] p-4">
      <p className="text-sm font-medium text-[var(--color-ink)]">
        Share live location with the employer
      </p>
      <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
        Helps them know you&apos;re on the way. Stops automatically when you
        leave the job page.
      </p>
      {error && (
        <p className="mt-2 text-xs text-[var(--color-brick)]">{error}</p>
      )}
      <div className="mt-3 flex gap-2 items-center">
        {sharing ? (
          <>
            <span className="inline-flex items-center gap-2 text-xs text-[var(--color-sage-700)]">
              <span className="w-2 h-2 rounded-full bg-[var(--color-sage-600)] animate-pulse" />
              Sharing live
            </span>
            <button
              type="button"
              onClick={stop}
              className="ml-auto px-4 py-2 rounded-pill text-sm border border-[var(--color-line)] hover:bg-[var(--color-paper)]"
            >
              Stop
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={start}
            className="px-4 py-2 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] text-sm"
          >
            Share my location
          </button>
        )}
      </div>
    </div>
  );
}

export function LiveLocationView({ job }: { job: Job }) {
  if (!job.workerLocation) {
    return (
      <div className="mt-4 rounded-xl bg-[var(--color-cream-2)] border border-[var(--color-line)] p-4 text-sm text-[var(--color-ink-soft)]">
        Worker hasn&apos;t started sharing their location yet.
      </div>
    );
  }

  const { lat, lng, updatedAt } = job.workerLocation;
  const isFresh = Date.now() - updatedAt < 60_000;
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-[var(--color-line)] bg-[var(--color-paper)]">
      <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--color-line)]">
        <div>
          <p className="text-sm font-medium text-[var(--color-ink)]">
            Worker&apos;s live location
          </p>
          <p className="text-xs text-[var(--color-ink-muted)]">
            Updated{" "}
            {isFresh
              ? "just now"
              : new Date(updatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
            {!job.workerLocationSharing && " · stopped sharing"}
          </p>
        </div>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--color-ochre-600)] hover:text-[var(--color-ochre-700)] underline"
        >
          Open in Maps
        </a>
      </div>
      <LiveMap lat={lat} lng={lng} />
    </div>
  );
}
