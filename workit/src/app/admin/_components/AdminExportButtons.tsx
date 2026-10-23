"use client";

import { useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import Button from "@/components/Button";
import type { Job, UserProfile } from "@/lib/types";

/**
 * One-click CSV exports for funder packs / offline analysis. Admin-only
 * surface; fetches fresh at click time so the export is never stale. The
 * user export includes contact details (it's the founder's own user base —
 * same data the panel already shows); ID numbers and documents are NOT
 * included (they live in the private subtree and stay there).
 */

function csv(rows: (string | number | undefined | null)[][]): string {
  const esc = (v: string | number | undefined | null) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";
}

function download(filename: string, content: string) {
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const day = (ms?: number) => (ms ? new Date(ms).toISOString().slice(0, 10) : "");

export default function AdminExportButtons() {
  const [busy, setBusy] = useState<"users" | "jobs" | null>(null);

  const exportUsers = async () => {
    setBusy("users");
    try {
      const snap = await getDocs(collection(getDb(), "users"));
      const rows: (string | number | undefined)[][] = [
        ["name", "email", "phone", "role", "account_status", "docs_status",
         "suburb", "city", "categories", "skills", "jobs_completed", "rating",
         "rating_count", "signed_up", "signup_source", "uid"],
      ];
      snap.docs
        .map((d) => ({ ...(d.data() as UserProfile), uid: d.id }))
        .filter((u) => u.role !== "admin")
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .forEach((u) =>
          rows.push([
            u.displayName, u.email, u.phone, u.role,
            u.accountStatus ?? "approved (legacy)", u.verificationStatus ?? "none",
            u.suburb, u.city, (u.categories ?? []).join("; "), (u.skills ?? []).join("; "),
            u.jobsCompleted ?? 0, u.ratingAvg ?? "", u.ratingCount ?? 0,
            day(u.createdAt), u.signupSource ?? "", u.uid,
          ]),
        );
      download(`workit-users-${day(Date.now())}.csv`, csv(rows));
    } finally {
      setBusy(null);
    }
  };

  const exportJobs = async () => {
    setBusy("jobs");
    try {
      const snap = await getDocs(collection(getDb(), "jobs"));
      const rows: (string | number | undefined)[][] = [
        ["title", "category", "status", "suggested_price", "agreed_price",
         "suburb", "city", "employer", "worker", "posted", "assigned",
         "completed", "offers", "job_id"],
      ];
      snap.docs
        .map((d) => ({ ...(d.data() as Job), id: d.id }))
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .forEach((j) =>
          rows.push([
            j.title, j.category, j.status, j.suggestedPrice, j.agreedPrice,
            j.suburb, j.city, j.employerName, j.assignedWorkerName,
            day(j.createdAt), day(j.assignedAt), day(j.completedAt),
            j.offerCount ?? 0, j.id,
          ]),
        );
      download(`workit-jobs-${day(Date.now())}.csv`, csv(rows));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mb-6 rounded-2xl p-4 bg-[var(--color-cream-2)] border border-[var(--color-line)] flex items-center justify-between gap-3 flex-wrap">
      <div>
        <p className="text-sm font-medium text-[var(--color-ink)]">Exports</p>
        <p className="text-xs text-[var(--color-ink-muted)]">
          CSV downloads for funder packs and offline analysis. No ID numbers or documents included.
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={exportUsers} loading={busy === "users"} loadingText="Exporting…">
          ⬇ Users CSV
        </Button>
        <Button size="sm" variant="outline" onClick={exportJobs} loading={busy === "jobs"} loadingText="Exporting…">
          ⬇ Jobs CSV
        </Button>
      </div>
    </div>
  );
}
