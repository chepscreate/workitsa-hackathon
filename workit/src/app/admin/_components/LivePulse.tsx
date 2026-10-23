"use client";

/**
 * LivePulse — the marketplace god-view. A dark Leaflet map with an animated
 * canvas overlay: workers as dots, available-now workers highlighted, live
 * offers, jobs plotted by status, an arc of light on every hire, expanding
 * pulses on events, an optional heat layer, a live KPI HUD and an event feed.
 * Two data sources:
 *   • Live  — Firestore onSnapshot (workers' PUBLIC approx location + availability;
 *             jobs' pin + status; pending offers via a collectionGroup query).
 *             No personal data, no live tracking.
 *   • Simulate — a scripted event loop (clustered by suburb) so the screen looks
 *             alive when the real marketplace is quiet (clearly badged SIMULATED).
 *
 * Cockpit v2 (2026-09-29): punchier heat (zoom-scaled), richer signals (offers +
 * real available-now + online footprint, not just jobs), auto-zoom to the busiest
 * suburb, and a suburb filter.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { collection, collectionGroup, onSnapshot, query, where } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { isAvailableNow } from "@/lib/types";

const GBOUNDS = { latMin: -26.55, latMax: -25.7, lngMin: 27.65, lngMax: 28.55 };
const CENTER: [number, number] = [-26.13, 28.05];
const ZOOM = 10;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]): T => a[(Math.random() * a.length) | 0];
const SIM_CATS = ["Gardening", "House cleaning", "Plumbing", "Electrical", "Deliveries",
  "Moving help", "Tutoring", "Painting", "Errands", "Car wash", "Tiling", "Child care"];

// Suburb clusters for Simulate mode — Alberton beachhead first, then wider Gauteng.
// Real activity carries its own `suburb` field; this only shapes the demo so the
// suburb filter + auto-zoom have believable geographic clusters to work with.
const SIM_SUBURBS: { name: string; lat: number; lng: number; w: number }[] = [
  { name: "Alberton", lat: -26.267, lng: 28.122, w: 5 },
  { name: "New Redruth", lat: -26.258, lng: 28.125, w: 3 },
  { name: "Brackenhurst", lat: -26.322, lng: 28.116, w: 3 },
  { name: "Meyersdal", lat: -26.291, lng: 28.128, w: 3 },
  { name: "Randhart", lat: -26.283, lng: 28.140, w: 2 },
  { name: "Germiston", lat: -26.218, lng: 28.170, w: 2 },
  { name: "Sandton", lat: -26.107, lng: 28.056, w: 1 },
  { name: "Soweto", lat: -26.267, lng: 27.858, w: 1 },
  { name: "Midrand", lat: -25.999, lng: 28.126, w: 1 },
  { name: "Benoni", lat: -26.190, lng: 28.320, w: 1 },
];
const SIM_SUB_BAG: typeof SIM_SUBURBS = SIM_SUBURBS.flatMap((s) => Array(s.w).fill(s));
const simSuburb = () => pick(SIM_SUB_BAG);
const jitter = (v: number) => v + rand(-0.014, 0.014);

type Worker = { lat: number; lng: number; available: boolean; suburb: string; ph: number };
type Job = { lat: number; lng: number; status: string; cat: string; price: number; ph: number;
  age: number; hireAt: number; doneAt: number; life: number; suburb: string; sim?: boolean };
type Offer = { jobId?: string; lat: number; lng: number; suburb: string; ph: number; life: number; sim?: boolean };
type Arc = { fx: number; fy: number; tx: number; ty: number; t: number; dur: number };
type Pulse = { lat: number; lng: number; kind: "open" | "hire" | "done" | "offer"; t: number };
type Counts = { workers: number; available: number; offers: number; open: number; done: number; rand: number };
type FeedItem = { id: number; text: string; color: string; time: string };

const PULSE_COL: Record<Pulse["kind"], string> = {
  open: "224,138,78", hire: "255,255,255", done: "143,181,106", offer: "109,182,201",
};
const OFFER_RGB = "109,182,201"; // cool teal — stands out against the warm map

// ---- the animated canvas overlay (lives inside the Leaflet map) ----
function PulseLayer({ mode, heatOn, focusSuburb, onCounts, onEvent, onHire, onSuburbs }: {
  mode: "live" | "sim"; heatOn: boolean; focusSuburb: string | null;
  onCounts: (c: Counts) => void; onEvent: (text: string, color: string) => void;
  onHire: () => void; onSuburbs: (list: string[]) => void;
}) {
  const map = useMap();
  const workers = useRef<Worker[]>([]);
  const jobs = useRef<Map<string, Job>>(new Map());
  const offers = useRef<Map<string, Offer>>(new Map());
  const arcs = useRef<Arc[]>([]);
  const pulses = useRef<Pulse[]>([]);
  const doneCum = useRef(0);   // sim: cumulative completed (jobs get removed after)
  const randCum = useRef(0);   // sim: cumulative rand earned
  const modeRef = useRef(mode);
  const focusRef = useRef(focusSuburb);
  const autoZoomed = useRef(false);
  const subSig = useRef("");
  const onEventRef = useRef(onEvent);
  const onHireRef = useRef(onHire);
  const onSuburbsRef = useRef(onSuburbs);
  useEffect(() => { onEventRef.current = onEvent; onHireRef.current = onHire; onSuburbsRef.current = onSuburbs; });

  const project = useCallback((lat: number, lng: number) => {
    try { return map.latLngToContainerPoint([lat, lng]); } catch { return { x: -99, y: -99 }; }
  }, [map]);

  const inFocus = (suburb: string) => !focusRef.current || suburb === focusRef.current;

  const addPulse = (lat: number, lng: number, kind: Pulse["kind"]) => {
    pulses.current.push({ lat, lng, kind, t: 0 });
    if (pulses.current.length > 60) pulses.current.shift();
  };
  const fireArc = (toLat: number, toLng: number) => {
    if (!workers.current.length) return;
    let best = workers.current[0], bd = Infinity;
    for (const w of workers.current) { const d = (w.lat - toLat) ** 2 + (w.lng - toLng) ** 2; if (d < bd) { bd = d; best = w; } }
    const f = project(best.lat, best.lng), t = project(toLat, toLng);
    arcs.current.push({ fx: f.x, fy: f.y, tx: t.x, ty: t.y, t: 0, dur: 1.1 });
  };

  // Resolve an offer's map position (sim offers carry their own; live offers
  // borrow their parent job's pin).
  const offerPos = (o: Offer): { lat: number; lng: number; suburb: string } | null => {
    if (o.sim) return { lat: o.lat, lng: o.lng, suburb: o.suburb };
    const j = o.jobId ? jobs.current.get(o.jobId) : undefined;
    if (!j) return null;
    return { lat: j.lat, lng: j.lng, suburb: j.suburb };
  };

  // ---- fly the camera to a suburb's activity ----
  const flyToSuburb = useCallback((name: string) => {
    const pts: [number, number][] = [];
    for (const w of workers.current) if (w.suburb === name) pts.push([w.lat, w.lng]);
    jobs.current.forEach((j) => { if (j.suburb === name) pts.push([j.lat, j.lng]); });
    offers.current.forEach((o) => { const p = offerPos(o); if (p && p.suburb === name) pts.push([p.lat, p.lng]); });
    if (!pts.length) return;
    try {
      if (pts.length === 1) map.flyTo(pts[0], 14, { duration: 0.8 });
      else map.flyToBounds(L.latLngBounds(pts).pad(0.35), { maxZoom: 14, duration: 0.8 });
    } catch { /* */ }
  }, [map]);

  const busiestSuburb = (): string | null => {
    const score = new Map<string, number>();
    const bump = (s: string, n: number) => { if (s) score.set(s, (score.get(s) ?? 0) + n); };
    for (const w of workers.current) bump(w.suburb, w.available ? 1.2 : 0.3);
    jobs.current.forEach((j) => { if (j.status === "open") bump(j.suburb, 2.2); });
    offers.current.forEach((o) => { const p = offerPos(o); if (p) bump(p.suburb, 1.6); });
    let best: string | null = null, bs = 0;
    score.forEach((v, k) => { if (v > bs) { bs = v; best = k; } });
    return best;
  };

  // report the distinct suburbs present so the HUD dropdown can list them
  const reportSuburbs = () => {
    const set = new Set<string>();
    for (const w of workers.current) if (w.suburb) set.add(w.suburb);
    jobs.current.forEach((j) => { if (j.suburb) set.add(j.suburb); });
    const list = [...set].sort();
    const sig = list.join("|");
    if (sig !== subSig.current) { subSig.current = sig; onSuburbsRef.current(list); }
  };

  // keep focusRef live + fly when the filter changes
  useEffect(() => {
    focusRef.current = focusSuburb;
    if (focusSuburb) flyToSuburb(focusSuburb);
    else { try { map.flyTo(CENTER, ZOOM, { duration: 0.8 }); } catch { /* */ } }
  }, [focusSuburb, flyToSuburb, map]);

  // ---- data source ----
  useEffect(() => {
    modeRef.current = mode;
    workers.current = []; jobs.current.clear(); offers.current.clear();
    arcs.current = []; pulses.current = []; autoZoomed.current = false; subSig.current = "";
    doneCum.current = 0; randCum.current = 0;

    if (mode === "live") {
      const unsubW = onSnapshot(
        query(collection(getDb(), "users"), where("role", "==", "worker"), where("accountStatus", "==", "approved")),
        (snap) => {
          const now = Date.now();
          workers.current = snap.docs.map((d) => d.data() as Record<string, unknown>)
            .filter((u) => typeof u.approxLat === "number" && typeof u.approxLng === "number")
            .map((u) => ({
              lat: u.approxLat as number, lng: u.approxLng as number,
              available: isAvailableNow({ availableNow: u.availableNow as boolean | undefined, availableNowAt: u.availableNowAt as number | undefined }, now),
              suburb: (typeof u.suburb === "string" ? u.suburb.trim() : ""),
              ph: Math.random() * 6.28,
            }));
        },
      );
      let firstJ = true;
      const unsubJ = onSnapshot(collection(getDb(), "jobs"), (snap) => {
        snap.docChanges().forEach((ch) => {
          const j = ch.doc.data() as Record<string, unknown>;
          const id = ch.doc.id;
          if (ch.type === "removed") { jobs.current.delete(id); return; }
          if (typeof j.lat !== "number" || typeof j.lng !== "number") return;
          const prev = jobs.current.get(id);
          const title = (typeof j.title === "string" && j.title) || (typeof j.category === "string" ? j.category : "Job");
          const price = (typeof j.agreedPrice === "number" ? j.agreedPrice : (j.suggestedPrice as number)) || 0;
          const rec: Job = { lat: j.lat as number, lng: j.lng as number, status: String(j.status ?? "open"),
            cat: title, price, ph: prev?.ph ?? Math.random() * 6.28, age: 0, hireAt: 0, doneAt: 0, life: 0,
            suburb: (typeof j.suburb === "string" ? j.suburb.trim() : "") };
          jobs.current.set(id, rec);
          if (!firstJ) {
            if (ch.type === "added" && rec.status === "open") { addPulse(rec.lat, rec.lng, "open"); onEventRef.current("New job · " + rec.cat, "#E08A4E"); }
            if (ch.type === "modified" && prev && prev.status !== rec.status) {
              if (rec.status === "assigned" || rec.status === "in_progress") { fireArc(rec.lat, rec.lng); addPulse(rec.lat, rec.lng, "hire"); onEventRef.current("Hired · " + rec.cat, "#F2E3CF"); onHireRef.current(); }
              if (rec.status === "confirmed" || rec.status === "completed") { addPulse(rec.lat, rec.lng, "done"); onEventRef.current("Completed · " + rec.cat, "#8FB56A"); }
            }
          }
        });
        firstJ = false;
      });
      // Pending offers across the whole marketplace (subcollection group).
      // No where()/orderBy() → no composite index needed; filter client-side.
      let firstO = true;
      const unsubO = onSnapshot(collectionGroup(getDb(), "offers"),
        (snap) => {
          snap.docChanges().forEach((ch) => {
            const id = ch.doc.id;
            const jobId = ch.doc.ref.parent.parent?.id;
            const status = String((ch.doc.data() as Record<string, unknown>).status ?? "");
            if (ch.type === "removed" || status !== "pending") { offers.current.delete(id); return; }
            const existed = offers.current.has(id);
            const j = jobId ? jobs.current.get(jobId) : undefined;
            offers.current.set(id, { jobId, lat: j?.lat ?? 0, lng: j?.lng ?? 0, suburb: j?.suburb ?? "", ph: Math.random() * 6.28, life: 0 });
            if (!firstO && !existed && j) { addPulse(j.lat, j.lng, "offer"); onEventRef.current("Offer · " + j.cat, "#6DB6C9"); }
          });
          firstO = false;
        },
        () => { /* rules may forbid the group read — degrade quietly */ },
      );
      return () => { unsubW(); unsubJ(); unsubO(); };
    }

    // ---- simulate (clustered by suburb) ----
    doneCum.current = 41; randCum.current = 13750;
    workers.current = Array.from({ length: 70 }, () => {
      const s = simSuburb();
      return { lat: jitter(s.lat), lng: jitter(s.lng), available: Math.random() < 0.5, suburb: s.name, ph: Math.random() * 6.28 };
    });
    let sid = 0;
    for (let i = 0; i < 8; i++) {
      const s = simSuburb();
      jobs.current.set("sim" + sid++, { lat: jitter(s.lat), lng: jitter(s.lng),
        status: Math.random() < 0.4 ? "in_progress" : "open", cat: pick(SIM_CATS),
        price: Math.round(rand(180, 850) / 10) * 10, ph: Math.random() * 6.28,
        age: rand(0, 3), hireAt: rand(2, 5), doneAt: rand(2, 5), life: 0, suburb: s.name, sim: true });
    }
    let oid = 0;
    simSpawn.current = () => {
      const s = simSuburb();
      jobs.current.set("sim" + sid++, { lat: jitter(s.lat), lng: jitter(s.lng), status: "open", cat: pick(SIM_CATS),
        price: Math.round(rand(180, 850) / 10) * 10, ph: Math.random() * 6.28, age: 0, hireAt: rand(2.2, 5.5),
        doneAt: 0, life: 0, suburb: s.name, sim: true });
      addPulse(jitter(s.lat), jitter(s.lng), "open");
    };
    simOffer.current = (j: Job) => {
      const key = "simo" + oid++;
      offers.current.set(key, { lat: jitter(j.lat), lng: jitter(j.lng), suburb: j.suburb, ph: Math.random() * 6.28, life: 0, sim: true });
      addPulse(j.lat, j.lng, "offer"); onEventRef.current("Offer · " + j.cat, "#6DB6C9");
      if (offers.current.size > 26) { const k = offers.current.keys().next().value; if (k) offers.current.delete(k); }
    };
    return () => { simSpawn.current = null; simOffer.current = null; };
  }, [mode, project]);

  const simSpawn = useRef<null | (() => void)>(null);
  const simOffer = useRef<null | ((j: Job) => void)>(null);
  const simAcc = useRef(0); const simNext = useRef(0.9);

  // ---- heat layer (zoom-scaled, punchier) ----
  useEffect(() => {
    if (!heatOn) return;
    const heatPts = (): [number, number, number][] => {
      const out: [number, number, number][] = [];
      for (const w of workers.current) if (inFocus(w.suburb)) out.push([w.lat, w.lng, w.available ? 0.95 : 0.45]);
      jobs.current.forEach((j) => { if (inFocus(j.suburb)) out.push([j.lat, j.lng, j.status === "open" ? 1.0 : 0.7]); });
      offers.current.forEach((o) => { const p = offerPos(o); if (p && inFocus(p.suburb)) out.push([p.lat, p.lng, 0.8]); });
      return out;
    };
    const opts = (z: number) => {
      const radius = z <= 10 ? 46 : z <= 12 ? 38 : z <= 14 ? 30 : 24;
      return { radius, blur: Math.round(radius * 0.72), max: 1.1, minOpacity: 0.32, maxZoom: 16,
        gradient: { 0.15: "#3c5233", 0.4: "#e0b15a", 0.62: "#e07a2e", 0.82: "#d0472a", 1.0: "#8f1d16" } };
    };
    const heat = (L as unknown as { heatLayer: (p: [number, number, number][], o?: Record<string, unknown>) => L.Layer })
      .heatLayer(heatPts(), opts(map.getZoom()));
    heat.addTo(map);
    const refresh = () => { try {
      (heat as unknown as { setOptions: (o: Record<string, unknown>) => void }).setOptions(opts(map.getZoom()));
      (heat as unknown as { setLatLngs: (p: unknown) => void }).setLatLngs(heatPts());
    } catch { /* */ } };
    const iv = setInterval(refresh, 1200);
    map.on("zoomend", refresh);
    return () => { clearInterval(iv); map.off("zoomend", refresh); try { heat.remove(); } catch { /* */ } };
  }, [heatOn, map]);

  // ---- canvas + animation loop ----
  useEffect(() => {
    const container = map.getContainer();
    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "450" });
    container.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;
    let raf = 0, last = performance.now(), kpiAcc = 0;
    const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;

    const snapshotCounts = () => {
      const live = modeRef.current === "live";
      let wN = 0, av = 0, open = 0, doneScan = 0, randScan = 0;
      for (const w of workers.current) { if (!inFocus(w.suburb)) continue; wN++; if (w.available) av++; }
      jobs.current.forEach((j) => {
        if (!inFocus(j.suburb)) return;
        if (j.status === "open") open++;
        if (j.status === "confirmed" || j.status === "completed") { doneScan++; randScan += j.price; }
      });
      let offN = 0;
      offers.current.forEach((o) => { const p = offerPos(o); if (p && inFocus(p.suburb)) offN++; });
      onCounts({
        workers: wN, available: av, offers: offN, open,
        done: live ? doneScan : doneCum.current, rand: live ? randScan : randCum.current,
      });
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const size = map.getSize();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== size.x * dpr || canvas.height !== size.y * dpr) { canvas.width = size.x * dpr; canvas.height = size.y * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.x, size.y);

      // sim spawn + lifecycle
      if (modeRef.current === "sim") {
        simAcc.current += dt;
        if (simAcc.current >= simNext.current && jobs.current.size < 32 && simSpawn.current) {
          simAcc.current = 0; simNext.current = reduce ? rand(2.4, 3.8) : rand(0.9, 2.2); simSpawn.current();
        }
        jobs.current.forEach((j, id) => {
          if (!j.sim) return; j.age += dt;
          if (j.status === "open") {
            // offers trickle in on open jobs, then it gets hired
            if (simOffer.current && Math.random() < dt * 0.7 && j.age > 0.5) simOffer.current(j);
            if (j.age >= j.hireAt) {
              j.status = "in_progress"; j.doneAt = rand(2.5, 5);
              offers.current.forEach((o, ok) => { if (o.sim && o.suburb === j.suburb && Math.abs(o.lat - j.lat) < 0.03 && Math.abs(o.lng - j.lng) < 0.03) offers.current.delete(ok); });
              fireArc(j.lat, j.lng); addPulse(j.lat, j.lng, "hire"); onEventRef.current("Hired · " + j.cat, "#F2E3CF"); onHireRef.current();
            }
          } else if (j.status === "in_progress") { j.doneAt -= dt; if (j.doneAt <= 0) { j.status = "done"; j.life = 0;
            doneCum.current++; randCum.current += j.price; addPulse(j.lat, j.lng, "done"); onEventRef.current("Completed · " + j.cat + " · R" + j.price, "#8FB56A"); } }
          else if (j.status === "done") { j.life += dt; if (j.life > 2.4) jobs.current.delete(id); }
        });
        offers.current.forEach((o, ok) => { if (o.sim) { o.life += dt; if (o.life > 7) offers.current.delete(ok); } });
      }

      // workers (filtered by suburb)
      for (const w of workers.current) {
        if (!inFocus(w.suburb)) continue;
        w.ph += dt * (reduce ? 0.6 : 1.6);
        const p = project(w.lat, w.lng); if (p.x < -20 || p.y < -20 || p.x > size.x + 20 || p.y > size.y + 20) continue;
        const tw = 0.6 + 0.4 * Math.sin(w.ph);
        ctx.fillStyle = (w.available ? "rgba(143,181,106," : "rgba(205,187,168,") + (0.35 + 0.5 * tw) + ")";
        ctx.beginPath(); ctx.arc(p.x, p.y, w.available ? 2.9 : 2.1, 0, 6.2832); ctx.fill();
        if (w.available) { ctx.fillStyle = "rgba(143,181,106," + (0.13 * tw) + ")"; ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, 6.2832); ctx.fill(); }
      }
      // offers (filtered) — cool teal diamonds so they read apart from jobs
      offers.current.forEach((o) => {
        const pos = offerPos(o); if (!pos || !inFocus(pos.suburb)) return;
        o.ph += dt * 2.4;
        const p = project(pos.lat, pos.lng); if (p.x < -30 || p.y < -30 || p.x > size.x + 30 || p.y > size.y + 30) return;
        const g = 0.5 + 0.5 * Math.sin(o.ph);
        const r = 4.5;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = "rgba(" + OFFER_RGB + "," + (0.35 + 0.4 * g) + ")"; ctx.lineWidth = 1.4;
        ctx.strokeRect(-r, -r, r * 2, r * 2);
        ctx.fillStyle = "rgba(" + OFFER_RGB + ",0.9)"; ctx.fillRect(-1.6, -1.6, 3.2, 3.2);
        ctx.restore();
      });
      // jobs (filtered)
      jobs.current.forEach((j) => {
        if (!inFocus(j.suburb)) return;
        j.ph += dt * 3;
        const p = project(j.lat, j.lng); if (p.x < -30 || p.y < -30 || p.x > size.x + 30 || p.y > size.y + 30) return;
        const rgb = j.status === "open" ? "224,138,78" : (j.status === "confirmed" || j.status === "completed" || j.status === "done") ? "143,181,106" : "224,177,90";
        const rr = 5 + (Math.sin(j.ph) * 0.5 + 0.5) * (j.status === "open" ? 9 : 5);
        ctx.strokeStyle = "rgba(" + rgb + ",0.5)"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.2832); ctx.stroke();
        ctx.fillStyle = "rgb(" + rgb + ")"; ctx.beginPath(); ctx.arc(p.x, p.y, 3.4, 0, 6.2832); ctx.fill();
      });
      // arcs
      for (let i = arcs.current.length - 1; i >= 0; i--) {
        const a = arcs.current[i]; a.t += dt / a.dur; if (a.t >= 1.35) { arcs.current.splice(i, 1); continue; }
        const mx = (a.fx + a.tx) / 2, my = (a.fy + a.ty) / 2 - Math.hypot(a.tx - a.fx, a.ty - a.fy) * 0.28;
        const pr = Math.min(1, a.t);
        ctx.strokeStyle = "rgba(224,138,78," + (0.55 * (1 - Math.max(0, a.t - 1) / 0.35)) + ")"; ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let sName = 0; sName <= pr * 20; sName++) { const u = sName / 20;
          const x = (1 - u) * (1 - u) * a.fx + 2 * (1 - u) * u * mx + u * u * a.tx;
          const y = (1 - u) * (1 - u) * a.fy + 2 * (1 - u) * u * my + u * u * a.ty;
          sName === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
        if (pr < 1) { const u = pr, x = (1 - u) * (1 - u) * a.fx + 2 * (1 - u) * u * mx + u * u * a.tx, y = (1 - u) * (1 - u) * a.fy + 2 * (1 - u) * u * my + u * u * a.ty;
          ctx.fillStyle = "#FCEBD8"; ctx.beginPath(); ctx.arc(x, y, 3, 0, 6.2832); ctx.fill();
          ctx.fillStyle = "rgba(252,235,216,0.35)"; ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.2832); ctx.fill(); }
      }
      // pulses
      for (let i = pulses.current.length - 1; i >= 0; i--) {
        const pl = pulses.current[i]; pl.t += dt; const k = pl.t / (reduce ? 0.6 : 1); if (k >= 1) { pulses.current.splice(i, 1); continue; }
        const p = project(pl.lat, pl.lng);
        ctx.strokeStyle = "rgba(" + PULSE_COL[pl.kind] + "," + (0.5 * (1 - k)) + ")"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 6 + k * 36, 0, 6.2832); ctx.stroke();
      }

      kpiAcc += dt;
      if (kpiAcc > 0.4) {
        kpiAcc = 0;
        snapshotCounts();
        reportSuburbs();
        // auto-zoom to the busiest suburb once, when data has arrived and the
        // user hasn't picked a suburb of their own.
        if (!autoZoomed.current && !focusRef.current && (workers.current.length > 0 || jobs.current.size > 0)) {
          const b = busiestSuburb();
          if (b) { autoZoomed.current = true; flyToSuburb(b); }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); try { canvas.remove(); } catch { /* */ } };
  }, [map, project, onCounts, flyToSuburb]);

  return null;
}

// ---- the full-screen HUD wrapper ----
export default function LivePulse() {
  const [mode, setMode] = useState<"live" | "sim">("sim");
  const [heatOn, setHeatOn] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [counts, setCounts] = useState<Counts>({ workers: 0, available: 0, offers: 0, open: 0, done: 0, rand: 0 });
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [clock, setClock] = useState("");
  const [suburbs, setSuburbs] = useState<string[]>([]);
  const [focusSuburb, setFocusSuburb] = useState<string | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const soundRef = useRef(soundOn); useEffect(() => { soundRef.current = soundOn; }, [soundOn]);
  const feedId = useRef(0);

  // reset the suburb filter when switching data source (suburb lists differ)
  useEffect(() => { setFocusSuburb(null); setSuburbs([]); }, [mode]);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })), 1000);
    setClock(new Date().toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    return () => clearInterval(t);
  }, []);

  const onCounts = useCallback((c: Counts) => setCounts(c), []);
  const onSuburbs = useCallback((list: string[]) => setSuburbs(list), []);
  const onEvent = useCallback((text: string, color: string) => {
    setFeed((f) => [{ id: feedId.current++, text, color, time: new Date().toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) }, ...f].slice(0, 8));
  }, []);
  const onHire = useCallback(() => {
    if (!soundRef.current || !audio.current) return;
    try {
      const ac = audio.current, t = ac.currentTime;
      [660, 990].forEach((freq, i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = "sine"; o.frequency.value = freq;
        g.gain.setValueAtTime(0, t + i * 0.08); g.gain.linearRampToValueAtTime(0.12, t + i * 0.08 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + 0.18);
        o.connect(g); g.connect(ac.destination); o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.2);
      });
    } catch { /* */ }
  }, []);

  const toggleSound = () => {
    if (!soundOn) { try { audio.current = audio.current || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); audio.current.resume(); } catch { /* */ } }
    setSoundOn((v) => !v);
  };

  const fmt = (n: number) => n.toLocaleString("en-ZA");
  const kpi = (label: string, val: string, cls: string) => (
    <div className="lp-kpi"><div className="lp-kpi-l">{label}</div><div className={"lp-kpi-v " + cls}>{val}</div></div>
  );

  return (
    <div className="lp-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <MapContainer center={CENTER} zoom={ZOOM} zoomControl={false} attributionControl={false} style={{ position: "absolute", inset: 0 }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" subdomains="abc" maxZoom={19} />
        <PulseLayer mode={mode} heatOn={heatOn} focusSuburb={focusSuburb} onCounts={onCounts} onEvent={onEvent} onHire={onHire} onSuburbs={onSuburbs} />
      </MapContainer>

      <div className="lp-scan" /><div className="lp-vig" />
      <div className="lp-brk lp-tl" /><div className="lp-brk lp-tr" /><div className="lp-brk lp-bl" /><div className="lp-brk lp-br" />

      {/* top bar */}
      <div className="lp-top">
        <div className="lp-brand">
          <span className="lp-w">Workit</span>
          <span className="lp-live"><span className="lp-dot" />Live · marketplace pulse</span>
          {mode === "sim" && <span className="lp-sim">Simulated</span>}
          {focusSuburb && <span className="lp-focus">◎ {focusSuburb}</span>}
          <span className="lp-clock">{clock}</span>
        </div>
        <div className="lp-kpis">
          {kpi("Workers", fmt(counts.workers), "cream")}
          {kpi("Available now", fmt(counts.available), "sage")}
          {kpi("Offers", fmt(counts.offers), "teal")}
          {kpi("Jobs open", fmt(counts.open), "ochre")}
          {kpi("Done today", fmt(counts.done), "sage")}
          {kpi("Earned today", "R" + fmt(counts.rand), "gold")}
        </div>
      </div>

      {/* event feed */}
      <div className="lp-feed">
        <h3>Live activity</h3>
        <ul>{feed.map((f) => (
          <li key={f.id}><span className="mk" style={{ background: f.color, boxShadow: "0 0 7px " + f.color }} />
            <span className="tx" dangerouslySetInnerHTML={{ __html: f.text.replace(/·/g, "<span class='sep'>·</span>") }} />
            <span className="t">{f.time}</span></li>
        ))}</ul>
        {feed.length === 0 && <p className="lp-empty">Waiting for activity…</p>}
      </div>

      {/* controls */}
      <div className="lp-ctrls">
        {suburbs.length > 0 && (
          <select className="lp-sel" value={focusSuburb ?? ""} onChange={(e) => setFocusSuburb(e.target.value || null)} aria-label="Filter by suburb">
            <option value="">◎ All areas</option>
            {suburbs.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <div className="lp-seg">
          <button className={mode === "live" ? "on" : ""} onClick={() => setMode("live")}>Live</button>
          <button className={mode === "sim" ? "on" : ""} onClick={() => setMode("sim")}>Simulate</button>
        </div>
        <button className={"lp-btn" + (heatOn ? " on" : "")} onClick={() => setHeatOn((v) => !v)}>◗ Heatmap</button>
        <button className={"lp-btn" + (soundOn ? " on" : "")} onClick={toggleSound}>♪ Sound</button>
        <Link href="/admin" className="lp-btn lp-exit">✕ Exit</Link>
      </div>

      {/* legend */}
      <div className="lp-legend">
        <span><i style={{ background: "#CDBBA8" }} />Worker</span>
        <span><i style={{ background: "#8FB56A" }} />Available now</span>
        <span><i className="dia" style={{ background: "#6DB6C9" }} />Offer</span>
        <span><i style={{ background: "#E08A4E" }} />Job open</span>
        <span><i style={{ background: "#E0B15A" }} />In progress</span>
        <span><i style={{ background: "#8FB56A" }} />Done</span>
        <span><i style={{ background: "#fff", boxShadow: "0 0 6px #E08A4E" }} />Hire</span>
      </div>
      <div className="lp-note">{mode === "sim"
        ? "Illustrative simulation — not live traffic."
        : "Live from Firestore · approx locations only, no personal data."}</div>
    </div>
  );
}

const CSS = `
.lp-root{position:fixed;inset:0;z-index:4000;background:#0E0A07;color:#FAF4EC;overflow:hidden;
  font-family:"IBM Plex Sans",system-ui,sans-serif}
.lp-root .leaflet-container{background:#0E0A07;font-family:inherit}
/* OSM has no free dark tiles; invert the standard tiles into a dark map (no API key). */
.lp-root .leaflet-tile{filter:invert(1) hue-rotate(180deg) brightness(.92) contrast(.88) saturate(.6)}
.lp-scan{position:absolute;inset:0;pointer-events:none;z-index:500;
  background:repeating-linear-gradient(0deg,rgba(255,255,255,0.018) 0 1px,transparent 1px 3px);mix-blend-mode:overlay}
.lp-vig{position:absolute;inset:0;pointer-events:none;z-index:500;
  background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,0.55) 100%)}
.lp-brk{position:absolute;width:26px;height:26px;border:2px solid rgba(217,119,66,0.5);z-index:520;pointer-events:none}
.lp-tl{left:12px;top:calc(12px + env(safe-area-inset-top,0px));border-right:0;border-bottom:0}
.lp-tr{right:12px;top:calc(12px + env(safe-area-inset-top,0px));border-left:0;border-bottom:0}
.lp-bl{left:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));border-right:0;border-top:0}
.lp-br{right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));border-left:0;border-top:0}
.lp-top{position:absolute;left:0;right:0;top:env(safe-area-inset-top,0px);z-index:530;
  display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;
  padding:18px 26px;pointer-events:none}
.lp-brand{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.lp-w{font-family:Georgia,serif;font-style:italic;font-weight:700;font-size:26px;color:#E08A4E;line-height:1}
.lp-live{display:flex;align-items:center;gap:7px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#A2917F}
.lp-dot{width:8px;height:8px;border-radius:50%;background:#8FB56A;box-shadow:0 0 9px #8FB56A;animation:lpb 1.6s infinite}
@keyframes lpb{0%,100%{opacity:1}50%{opacity:.35}}
.lp-sim{font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#E0B15A;
  border:1px solid rgba(224,177,90,.4);border-radius:999px;padding:3px 9px}
.lp-focus{font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#6DB6C9;
  border:1px solid rgba(109,182,201,.45);border-radius:999px;padding:3px 9px}
.lp-clock{font-variant-numeric:tabular-nums;font-size:12px;color:#6E5F51;letter-spacing:.1em}
.lp-kpis{display:flex;gap:10px;flex-wrap:wrap}
.lp-kpi{background:rgba(20,15,11,.66);border:1px solid rgba(217,119,66,.22);border-radius:12px;
  padding:8px 15px;min-width:90px;backdrop-filter:blur(7px)}
.lp-kpi-l{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:#A2917F}
.lp-kpi-v{font-family:Georgia,serif;font-weight:700;font-size:24px;line-height:1.15;margin-top:1px;font-variant-numeric:tabular-nums}
.lp-kpi-v.cream{color:#FAF4EC}.lp-kpi-v.ochre{color:#E08A4E}.lp-kpi-v.sage{color:#8FB56A}.lp-kpi-v.gold{color:#E0B15A}.lp-kpi-v.teal{color:#6DB6C9}
.lp-feed{position:absolute;right:26px;top:104px;width:266px;max-width:44vw;z-index:530;
  background:rgba(20,15,11,.66);border:1px solid rgba(217,119,66,.22);border-radius:14px;
  padding:13px 13px 8px;backdrop-filter:blur(7px);pointer-events:none}
.lp-feed h3{margin:0 0 9px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#A2917F;font-weight:600}
.lp-feed ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.lp-feed li{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;line-height:1.3;animation:lpin .4s ease}
.lp-feed .mk{width:8px;height:8px;border-radius:50%;margin-top:4px;flex:0 0 auto}
.lp-feed .tx{color:#E7DACB}.lp-feed .tx .sep{color:#6E5F51;margin:0 2px}
.lp-feed .t{color:#6E5F51;font-size:10.5px;margin-left:auto;padding-left:8px;white-space:nowrap;font-variant-numeric:tabular-nums}
.lp-empty{color:#6E5F51;font-size:12px;margin:4px 2px 6px}
@keyframes lpin{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.lp-ctrls{position:absolute;right:26px;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:540;
  display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.lp-seg{display:flex;background:rgba(20,15,11,.7);border:1px solid rgba(217,119,66,.25);border-radius:999px;overflow:hidden}
.lp-seg button{background:transparent;border:0;color:#A2917F;font:600 12px "IBM Plex Sans",sans-serif;
  padding:8px 16px;cursor:pointer;letter-spacing:.03em}
.lp-seg button.on{background:#D97742;color:#140F0B}
.lp-btn{background:rgba(20,15,11,.7);border:1px solid rgba(217,119,66,.25);border-radius:999px;
  color:#D8CBBC;font:600 12px "IBM Plex Sans",sans-serif;padding:8px 15px;cursor:pointer;
  text-decoration:none;display:inline-flex;align-items:center;gap:6px}
.lp-btn.on{background:rgba(217,119,66,.22);color:#F2E3CF;border-color:rgba(217,119,66,.5)}
.lp-btn:hover{border-color:rgba(217,119,66,.55)}
.lp-exit{color:#A2917F}
.lp-sel{background:rgba(20,15,11,.7);border:1px solid rgba(109,182,201,.35);border-radius:999px;
  color:#D8CBBC;font:600 12px "IBM Plex Sans",sans-serif;padding:8px 14px;cursor:pointer;
  appearance:none;-webkit-appearance:none;max-width:44vw}
.lp-sel:hover{border-color:rgba(109,182,201,.6)}
.lp-sel option{background:#140F0B;color:#E7DACB}
.lp-legend{position:absolute;left:26px;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:530;
  display:flex;gap:14px;flex-wrap:wrap;background:rgba(20,15,11,.66);border:1px solid rgba(217,119,66,.22);
  border-radius:999px;padding:8px 16px;backdrop-filter:blur(7px);font-size:11px;color:#D8CBBC;pointer-events:none}
.lp-legend span{display:inline-flex;align-items:center;gap:6px}
.lp-legend i{width:9px;height:9px;border-radius:50%;display:inline-block}
.lp-legend i.dia{border-radius:1px;transform:rotate(45deg)}
.lp-note{position:absolute;left:26px;bottom:calc(56px + env(safe-area-inset-bottom,0px));z-index:530;
  font-size:10.5px;color:#6E5F51;pointer-events:none;max-width:60vw}
@media (max-width:760px){
  .lp-feed{display:none}.lp-note{display:none}
  .lp-top{padding:14px 16px}.lp-kpi{min-width:0;padding:7px 10px}.lp-kpi-v{font-size:18px}
  .lp-legend{font-size:10px;gap:9px;left:14px;padding:7px 12px}
  .lp-ctrls{right:14px;left:14px}
}
@media (prefers-reduced-motion:reduce){.lp-feed li{animation:none}.lp-dot{animation:none}}
`;
