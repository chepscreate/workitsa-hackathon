"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Badge from "@/components/Badge";
import Avatar from "@/components/Avatar";
import Button from "@/components/Button";
import Textarea from "@/components/Textarea";
import { StarsRead } from "@/components/Stars";
import { PhotoGrid } from "@/components/ImageLightbox";
import ReportButton from "@/components/ReportButton";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { createBusinessLead, hasExpressedInterest } from "@/lib/businessLeads";
import { CATEGORIES, type CategoryId, type Job, type UserProfile } from "@/lib/types";

function categoryLabel(id: CategoryId): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

function BusinessProfileInner({ uid }: { uid: string }) {
  const { user, profile: viewer, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [openJobs, setOpenJobs] = useState<Job[]>([]);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), "users", uid));
        if (cancelled) return;
        if (!snap.exists()) setProfile(null);
        else setProfile({ ...(snap.data() as UserProfile), uid });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("permission") || msg.includes("insufficient")) setDenied(true);
        else setProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, authLoading]);

  // Their open jobs (best-effort; filtered client-side to avoid a new index).
  useEffect(() => {
    if (!profile || profile.role !== "business") return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(getDb(), "jobs"), where("employerId", "==", uid), limit(25)),
        );
        if (cancelled) return;
        const jobs = snap.docs
          .map((d) => ({ ...(d.data() as Job), id: d.id }))
          .filter((j) => j.status === "open")
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
          .slice(0, 8);
        setOpenJobs(jobs);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, uid]);

  if (authLoading || profile === undefined) {
    return <p className="text-[var(--color-ink-muted)]">Loading profile…</p>;
  }
  if (denied || (!user && profile === null)) {
    return (
      <div className="rounded-2xl p-8 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft text-center">
        <h1 className="font-display text-2xl tracking-tight mb-2">Sign in to view this business</h1>
        <p className="text-sm text-[var(--color-ink-soft)]">
          Workit profiles are only visible to signed-in users.
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href={`/signup?next=${encodeURIComponent(`/business?id=${uid}`)}`}
            className="px-5 py-3 rounded-pill bg-[var(--color-ochre-500)] text-[var(--color-cream)] text-sm font-medium hover:bg-[var(--color-ochre-600)]"
          >
            Create account
          </Link>
          <Link
            href={`/signin?next=${encodeURIComponent(`/business?id=${uid}`)}`}
            className="px-5 py-3 rounded-pill border border-[var(--color-line)] text-sm hover:bg-[var(--color-cream-2)]"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }
  if (profile === null || profile.role !== "business") {
    return (
      <p>
        Business not found.{" "}
        <Link href="/find-work" className="underline">Browse open jobs</Link>.
      </p>
    );
  }

  const name = profile.businessName || profile.displayName || "Business";
  const verified = profile.businessVerification?.status === "approved";
  const isOwner = user?.uid === uid;
  const ratingCount = profile.ratingCount ?? 0;

  return (
    <div className="space-y-8">
      {/* Header card */}
      <div className="rounded-2xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
        <div className="flex items-start gap-4 flex-wrap">
          <Avatar name={name} photoURL={profile.businessLogoURL || profile.photoURL} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-3xl tracking-tight">{name}</h1>
              {profile.businessPro && <Badge tone="ochre">✦ Pro</Badge>}
              {verified ? (
                <Badge tone="sage">✓ Verified business</Badge>
              ) : (
                <Badge tone="stone">Business</Badge>
              )}
            </div>
            {profile.businessTagline && (
              <p className="mt-1 text-[var(--color-ink-soft)]">{profile.businessTagline}</p>
            )}
            <div className="mt-2 flex items-center gap-3 flex-wrap text-sm">
              {ratingCount > 0 ? (
                <span className="flex items-center gap-1.5">
                  <StarsRead value={profile.ratingAvg ?? 0} />
                  <span className="text-[var(--color-ink-muted)]">
                    {(profile.ratingAvg ?? 0).toFixed(1)} · {ratingCount} rating{ratingCount === 1 ? "" : "s"}
                  </span>
                </span>
              ) : (
                <span className="text-[var(--color-ink-muted)]">New business · no ratings yet</span>
              )}
              {profile.businessAreaServed && (
                <span className="text-[var(--color-ink-muted)]">📍 {profile.businessAreaServed}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {isOwner && (
              <Link
                href="/business/edit"
                className="px-4 py-2 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] text-sm text-center hover:opacity-90"
              >
                Edit profile
              </Link>
            )}
            {!isOwner && viewer?.role === "worker" && (
              <InterestAction businessUid={uid} businessName={name} />
            )}
            {!isOwner && user && (
              <ReportButton targetType="user" targetId={uid} targetUserUid={uid} />
            )}
          </div>
        </div>

        {/* Categories */}
        {profile.businessCategories && profile.businessCategories.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.businessCategories.map((c) => (
              <Badge key={c} tone="ochre">{categoryLabel(c)}</Badge>
            ))}
          </div>
        )}

        {/* Contact */}
        {(profile.businessWebsite || profile.businessPublicPhone || profile.businessPublicEmail) && (
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            {profile.businessWebsite && (
              <a href={profile.businessWebsite} target="_blank" rel="noopener noreferrer" className="underline text-[var(--color-ink)]">
                🌐 Website
              </a>
            )}
            {profile.businessPublicPhone && (
              <a href={`tel:${profile.businessPublicPhone}`} className="underline text-[var(--color-ink)]">
                📞 {profile.businessPublicPhone}
              </a>
            )}
            {profile.businessPublicEmail && (
              <a href={`mailto:${profile.businessPublicEmail}`} className="underline text-[var(--color-ink)]">
                ✉️ {profile.businessPublicEmail}
              </a>
            )}
          </div>
        )}
      </div>

      {/* About */}
      {profile.businessDescription && (
        <section className="rounded-2xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
          <h2 className="font-display text-xl mb-2">About</h2>
          <p className="text-[var(--color-ink-soft)] leading-relaxed whitespace-pre-wrap">
            {profile.businessDescription}
          </p>
        </section>
      )}

      {/* Photos */}
      {profile.businessPhotoURLs && profile.businessPhotoURLs.length > 0 && (
        <section className="rounded-2xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
          <h2 className="font-display text-xl mb-3">Our work</h2>
          <PhotoGrid urls={profile.businessPhotoURLs} />
        </section>
      )}

      {/* Open jobs */}
      {openJobs.length > 0 && (
        <section className="rounded-2xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
          <h2 className="font-display text-xl mb-3">Open jobs ({openJobs.length})</h2>
          <ul className="divide-y divide-[var(--color-line)]">
            {openJobs.map((j) => (
              <li key={j.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/jobs?id=${j.id}`} className="font-medium hover:underline">
                    {j.title}
                  </Link>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {categoryLabel(j.category)} · {j.suburb}
                  </p>
                </div>
                <span className="text-sm font-medium whitespace-nowrap">R {j.suggestedPrice}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function InterestAction({ businessUid, businessName }: { businessUid: string; businessName: string }) {
  const { user, profile } = useAuth();
  const [expressed, setExpressed] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    hasExpressedInterest(businessUid, user.uid)
      .then((yes) => {
        if (!cancelled && yes) setExpressed(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [businessUid, user]);

  const send = async () => {
    if (!user || !profile) return;
    setSending(true);
    try {
      await createBusinessLead({
        businessUid,
        workerUid: user.uid,
        workerName: profile.displayName,
        workerPhotoURL: profile.photoURL,
        message: message.trim() || undefined,
      });
      setExpressed(true);
      setOpen(false);
    } finally {
      setSending(false);
    }
  };

  if (expressed) {
    return (
      <span className="text-xs text-[var(--color-sage-700)] font-medium text-center px-3 py-2">
        ✓ Interest sent
      </span>
    );
  }

  if (!open) {
    return (
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        I&apos;m interested
      </Button>
    );
  }

  return (
    <div className="w-64 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] p-3 shadow-soft">
      <p className="text-xs text-[var(--color-ink-soft)] mb-2">
        Let {businessName} know you&apos;d like to work with them. They&apos;ll see your profile.
      </p>
      <Textarea
        label=""
        name="interestMessage"
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Optional: a short note (skills, availability)…"
      />
      <div className="mt-2 flex gap-2">
        <Button variant="primary" size="sm" onClick={send} loading={sending} loadingText="Sending…">
          Send
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={sending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function BusinessProfileWithParams() {
  const search = useSearchParams();
  const id = search.get("id");
  if (!id) {
    return (
      <p>
        No business selected.{" "}
        <Link href="/find-work" className="underline">Browse open jobs</Link>.
      </p>
    );
  }
  return <BusinessProfileInner uid={id} />;
}

export default function BusinessProfilePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-14 max-w-4xl">
          <Suspense fallback={<p className="text-[var(--color-ink-muted)]">Loading…</p>}>
            <BusinessProfileWithParams />
          </Suspense>
        </Container>
      </main>
      <Footer />
    </>
  );
}
