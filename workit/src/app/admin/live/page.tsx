"use client";

/**
 * /admin/live — the marketplace "pulse" god-view. Full-screen mission-control:
 * a dark map with workers as dots, jobs plotted by status, an arc of light on
 * every hire, a heatmap toggle, and a Live/Simulate switch. Admin-only.
 *
 * The map (Leaflet) needs `window`, so the heavy component is dynamically
 * imported with ssr:false — same pattern as the admin heatmap.
 */

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const shell = {
  position: "fixed" as const, inset: 0, background: "#0E0A07", color: "#A2917F",
  display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", fontSize: 14,
};

const LivePulse = dynamic(() => import("../_components/LivePulse"), {
  ssr: false,
  loading: () => <div style={shell}>Booting live view…</div>,
});

export default function LivePage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const isAdmin = profile?.role === "admin" || !!profile?.adminRole;

  useEffect(() => {
    if (!loading && (!profile || !isAdmin)) router.replace("/account");
  }, [loading, profile, isAdmin, router]);

  if (loading || !profile || !isAdmin) return <div style={shell}>Checking access…</div>;
  return <LivePulse />;
}
