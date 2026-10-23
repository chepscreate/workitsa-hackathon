"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Badge from "@/components/Badge";
import Avatar from "@/components/Avatar";
import Button from "@/components/Button";
import ReputationBadges from "@/components/ReputationBadges";
import WorkerLevelBadge from "@/components/WorkerLevelBadge";
import { StarsRead } from "@/components/Stars";
import { PhotoGrid } from "@/components/ImageLightbox";
import ProfileShareCard from "@/components/ProfileShareCard";
import ReportButton from "@/components/ReportButton";
import { ProfileSkeleton } from "@/components/Skeleton";
import { getDb } from "@/lib/firebase";
import { listWorkerProofOfWork } from "@/lib/jobs";
import { CATEGORIES, computeBadges, ageFromDob, ageFromYear, genderLabel, isAvailableNow, skillLabel, type UserProfile } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import { updateDoc } from "firebase/firestore";
import { useConfirm } from "@/contexts/ConfirmContext";

function PublicProfileInner({ uid }: { uid: string }) {
  const { user, profile: viewerProfile, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [proofOfWork, setProofOfWork] = useState<{ url: string; jobId: string; title: string }[]>([]);

  useEffect(() => {
    // Wait for auth state before fetching — saves a needless permission-denied
    // error if the user is in the middle of a refresh.
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
        if (msg.includes("permission") || msg.includes("Missing or insufficient")) {
          setPermissionDenied(true);
        } else {
          setProfile(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, authLoading]);

  // Proof-of-work gallery: completion photos from this worker's confirmed jobs.
  useEffect(() => {
    if (!profile || profile.role !== "worker") {
      setProofOfWork([]);
      return;
    }
    if (profile.accountStatus !== "approved" && user?.uid !== uid) {
      setProofOfWork([]);
      return;
    }
    let cancelled = false;
    listWorkerProofOfWork(uid).then((p) => {
      if (!cancelled) setProofOfWork(p);
    });
    return () => {
      cancelled = true;
    };
  }, [profile, uid, user?.uid]);

  if (authLoading || profile === undefined) {
    return <ProfileSkeleton />;
  }
  if (permissionDenied || (!user && profile === null)) {
    // Guest hitting a private/missing profile — invite them to join.
    return (
      <div className="rounded-2xl p-8 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft text-center">
        <h1 className="font-display text-2xl tracking-tight mb-2">
          Sign in to view this profile
        </h1>
        <p className="text-sm text-[var(--color-ink-soft)]">
          Workit profiles are only visible to signed-in users. Create a free
          account in 30 seconds to see who&apos;s behind this link.
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href={`/signup?next=${encodeURIComponent(`/u?id=${uid}`)}`}
            className="px-5 py-3 rounded-pill bg-[var(--color-ochre-500)] text-[var(--color-cream)] text-sm font-medium hover:bg-[var(--color-ochre-600)]"
          >
            Create account
          </Link>
          <Link
            href={`/signin?next=${encodeURIComponent(`/u?id=${uid}`)}`}
            className="px-5 py-3 rounded-pill border border-[var(--color-line)] text-sm hover:bg-[var(--color-cream-2)]"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }
  if (profile === null) {
    return (
      <p>
        Profile not found.{" "}
        <Link href="/" className="underline">Workit home</Link>.
      </p>
    );
  }

  // Only show approved profiles publicly. Self can preview their own.
  const isSelf = user?.uid === uid;
  if (profile.accountStatus !== "approved" && !isSelf) {
    return (
      <p className="text-[var(--color-ink-muted)]">
        This profile isn&apos;t public yet.
      </p>
    );
  }

  const badges = computeBadges(profile);
  const categories = (profile.categories ?? [])
    .map((id) => CATEGORIES.find((c) => c.id === id)?.label ?? id);
  const skills = (profile.skills ?? [])
    .map((id) => skillLabel(id))
    .filter((s): s is string => !!s);
  const available = profile.role === "worker" && isAvailableNow(profile);
  const portfolio = profile.verification?.skillProofURLs ?? [];
  const showcaseImages = profile.portfolioImageURLs ?? [];
  const showcaseVideos = profile.portfolioVideoURLs ?? [];
  const qualifications = profile.qualifications ?? [];
  const hasPortfolio =
    !!profile.tagline
    || !!profile.cvURL
    || showcaseImages.length > 0
    || showcaseVideos.length > 0
    || qualifications.length > 0;

  return (
    <>
      {/* Portfolio cover band — warm gradient hero so the page reads as a
          showcase, not a plain settings card. Avatar overlaps it below. */}
      <div className="relative h-36 sm:h-44 rounded-3xl overflow-hidden bg-gradient-to-br from-[var(--color-sage-600)] via-[var(--color-ochre-500)] to-[var(--color-ochre-600)] shadow-soft">
        <div
          aria-hidden
          className="absolute inset-0 opacity-25 mix-blend-soft-light"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 28%, #fff 1.5px, transparent 1.5px), radial-gradient(circle at 70% 70%, #fff 1px, transparent 1px)",
            backgroundSize: "26px 26px, 18px 18px",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/15 to-transparent" />
      </div>

      {/* relative z-10: the cover band above is `position: relative`, so without
          this the band (a positioned element) would paint OVER this static
          content and hide the name/avatar that overlap up into it. */}
      <div className="relative z-10 grid lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar — identity card (lifts up into the cover band) */}
        <aside className="lg:col-span-4 -mt-20 sm:-mt-24">
          <div className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft text-center">
            <div className="flex justify-center -mt-16">
              <div className="rounded-full ring-4 ring-[var(--color-paper)] shadow-lift">
                <Avatar name={profile.displayName} photoURL={profile.photoURL} size="xl" />
              </div>
            </div>
            <h1 className="mt-4 font-display text-2xl sm:text-3xl tracking-tight">
              {profile.displayName}
            </h1>
            <p className="text-xs text-[var(--color-ink-muted)] capitalize mt-1">
              {profile.role} {profile.suburb && `· ${profile.suburb}`}
            </p>
            {(() => {
              // Public profiles expose only birthYear (Phase B); dateOfBirth is
              // a legacy fallback for profiles created before the migration.
              const age = ageFromYear(profile.birthYear) ?? ageFromDob(profile.dateOfBirth);
              if (!genderLabel(profile.gender) && age == null) return null;
              return (
                <p className="text-xs text-[var(--color-ink-muted)] mt-1">
                  {[genderLabel(profile.gender), age != null ? `${age} yrs` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              );
            })()}
            {available && (
              <p className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-xs font-medium bg-[var(--color-sage-100)] text-[var(--color-sage-700)] border border-[var(--color-sage-400)]/50">
                <span className="w-2 h-2 rounded-full bg-[var(--color-sage-600)] animate-pulse" />
                Available for work right now
              </p>
            )}
            {profile.tagline && (
              <p className="mt-2 text-sm text-[var(--color-ink-soft)] italic">
                {profile.tagline}
              </p>
            )}
            <div className="mt-3 flex justify-center">
              <StarsRead value={profile.ratingAvg} count={profile.ratingCount} />
            </div>
            {badges.length > 0 && (
              <div className="mt-4 flex justify-center">
                <ReputationBadges badges={badges} />
              </div>
            )}
            {profile.role === "worker" && (
              <div className="mt-4 flex justify-center">
                <WorkerLevelBadge profile={profile} />
              </div>
            )}
            {/* Action button is context-aware. The old hard-coded "Post a job"
                made no sense when a worker was viewing an employer, or anyone
                was viewing their own profile. */}
            <ProfileActionButton
              viewerProfile={viewerProfile}
              viewerSignedIn={!!user}
              profile={profile}
              isSelf={isSelf}
            />
            {user && user.uid !== profile.uid && (
              <BlockButton targetUid={profile.uid} targetName={profile.displayName} />
            )}
          </div>
        </aside>

        {/* Main column */}
        <div className="lg:col-span-8 space-y-6">
          {profile.bio && (
            <section className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
              <h2 className="font-display text-xl">About</h2>
              <p className="mt-2 text-[var(--color-ink-soft)] whitespace-pre-wrap leading-relaxed">
                {profile.bio}
              </p>
            </section>
          )}

          {(categories.length > 0 || skills.length > 0) && (
            <section className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
              <h2 className="font-display text-xl">Works in</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <Badge key={c} tone="ochre">{c}</Badge>
                ))}
              </div>
              {skills.length > 0 && (
                <>
                  <p className="mt-4 text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
                    Specific skills
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {skills.map((s) => (
                      <span
                        key={s}
                        className="px-3 py-1 rounded-pill text-xs bg-[var(--color-cream-2)] border border-[var(--color-line)] text-[var(--color-ink-soft)]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {qualifications.length > 0 && (
            <section className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
              <h2 className="font-display text-xl">Qualifications</h2>
              <ul className="mt-3 space-y-2">
                {qualifications.map((q, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-3 text-sm text-[var(--color-ink-soft)] border-b border-[var(--color-line)]/50 pb-2 last:border-b-0 last:pb-0"
                  >
                    <span>
                      <b className="text-[var(--color-ink)]">{q.title}</b>
                      {q.issuer && (
                        <span className="text-[var(--color-ink-muted)]"> · {q.issuer}</span>
                      )}
                    </span>
                    {q.year && (
                      <span className="text-xs text-[var(--color-ink-muted)] whitespace-nowrap">
                        {q.year}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {profile.cvURL && (
            <section className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-display text-xl">CV</h2>
                <p className="text-xs text-[var(--color-ink-muted)] mt-1">
                  Downloadable copy uploaded by {profile.displayName.split(" ")[0]}.
                </p>
              </div>
              <a
                href={profile.cvURL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] text-sm font-medium hover:opacity-90"
              >
                Open CV →
              </a>
            </section>
          )}

          {showcaseImages.length > 0 && (
            <section className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
              <h2 className="font-display text-xl">Showcase photos</h2>
              <p className="text-xs text-[var(--color-ink-muted)] mt-1">
                {showcaseImages.length} {showcaseImages.length === 1 ? "photo" : "photos"} · tap to zoom
              </p>
              <div className="mt-4">
                <PhotoGrid urls={showcaseImages} />
              </div>
            </section>
          )}

          {showcaseVideos.length > 0 && (
            <section className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
              <h2 className="font-display text-xl">Showcase videos</h2>
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                {showcaseVideos.map((url) => (
                  /* eslint-disable-next-line jsx-a11y/media-has-caption */
                  <video
                    key={url}
                    src={url}
                    controls
                    preload="metadata"
                    className="w-full rounded-lg border border-[var(--color-line)] bg-black aspect-video"
                  />
                ))}
              </div>
            </section>
          )}

          {proofOfWork.length > 0 && (
            <section className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
              <h2 className="font-display text-xl">Recent work</h2>
              <p className="text-xs text-[var(--color-ink-muted)] mt-1">
                {proofOfWork.length} {proofOfWork.length === 1 ? "photo" : "photos"} from
                completed jobs · tap to zoom
              </p>
              <div className="mt-4">
                <PhotoGrid urls={proofOfWork.map((p) => p.url)} />
              </div>
            </section>
          )}

          {portfolio.length > 0 && (
            <section className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
              <h2 className="font-display text-xl">Past work (from verification)</h2>
              <p className="text-xs text-[var(--color-ink-muted)] mt-1">
                {portfolio.length} {portfolio.length === 1 ? "photo" : "photos"} · tap to zoom
              </p>
              <div className="mt-4">
                <PhotoGrid urls={portfolio} />
              </div>
            </section>
          )}

          {!profile.bio
            && categories.length === 0
            && portfolio.length === 0
            && proofOfWork.length === 0
            && !hasPortfolio && (
            <div className="rounded-xl p-10 bg-[var(--color-paper)] border border-dashed border-[var(--color-line)] text-center text-[var(--color-ink-muted)]">
              {profile.displayName} hasn&apos;t filled in their profile yet.
            </div>
          )}

          <ProfileShareCard profile={profile} />

          {user && !isSelf && (
            <div className="rounded-2xl p-5 bg-[var(--color-cream-2)] border border-[var(--color-line)] flex items-center justify-between gap-3 flex-wrap text-xs text-[var(--color-ink-muted)]">
              <span>
                Something off about this profile?
              </span>
              <ReportButton
                targetType="user"
                targetId={profile.uid}
                targetUserUid={profile.uid}
                label="Report this profile"
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * Context-aware action button under the profile sidebar.
 *
 *  - Viewing your own profile     → "Edit your profile" → /profile
 *  - Guest viewing anyone          → "Sign up" CTA (joins to leave an offer / hire)
 *  - Employer viewing a worker     → "Post a job this worker can offer on" → /post-a-job
 *  - Worker viewing an employer    → "See their open jobs" → /find-work
 *  - Worker viewing a worker       → nothing (no relevant action)
 *  - Employer viewing an employer  → nothing
 */
function ProfileActionButton({
  viewerProfile,
  viewerSignedIn,
  profile,
  isSelf,
}: {
  viewerProfile: UserProfile | null;
  viewerSignedIn: boolean;
  profile: UserProfile;
  isSelf: boolean;
}) {
  const firstName = profile.displayName.split(" ")[0];

  if (isSelf) {
    return (
      <div className="mt-6">
        <Button href="/profile" variant="primary" size="md" className="w-full">
          Edit your profile
        </Button>
      </div>
    );
  }

  if (!viewerSignedIn) {
    return (
      <div className="mt-6">
        <Button
          href={`/signup?next=${encodeURIComponent(`/u?id=${profile.uid}`)}`}
          variant="primary"
          size="md"
          className="w-full"
        >
          Sign up to hire {firstName}
        </Button>
        <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
          Free to join — takes about 30 seconds.
        </p>
      </div>
    );
  }

  const viewerRole = viewerProfile?.role;
  const targetRole = profile.role;

  // Employer-style viewer looking at a worker → invite them to a specific job
  if ((viewerRole === "employer" || viewerRole === "admin") && targetRole === "worker") {
    return (
      <div className="mt-6">
        <Button
          href={`/post-a-job?invite=${profile.uid}`}
          variant="primary"
          size="md"
          className="w-full"
        >
          Invite {firstName} to a job
        </Button>
        <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
          {firstName} gets a direct notification. The job still goes public so
          other workers can offer too.
        </p>
      </div>
    );
  }

  // Worker viewing an employer → browse their open jobs
  if (viewerRole === "worker" && (targetRole === "employer" || targetRole === "admin")) {
    return (
      <div className="mt-6">
        <Button href="/find-work" variant="primary" size="md" className="w-full">
          See open jobs
        </Button>
        <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
          Browse the feed — any of {firstName}&apos;s jobs will show up there.
        </p>
      </div>
    );
  }

  // Same-side viewing (worker→worker, employer→employer) — no relevant CTA.
  return null;
}

function BlockButton({ targetUid, targetName }: { targetUid: string; targetName: string }) {
  const { user, profile, refreshProfile } = useAuth();
  const confirm = useConfirm();
  const isBlocked = profile?.blockedUserIds?.includes(targetUid) ?? false;
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!user || !profile) return;
    const ok = await confirm({
      title: isBlocked ? `Unblock ${targetName}?` : `Block ${targetName}?`,
      body: isBlocked
        ? "Their jobs / offers will reappear in your feed."
        : "You won't see this person's jobs or offers any more. You can unblock from their profile.",
      tone: isBlocked ? "neutral" : "danger",
      confirmLabel: isBlocked ? "Unblock" : "Yes, block",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const next = isBlocked
        ? (profile.blockedUserIds ?? []).filter((id) => id !== targetUid)
        : [...(profile.blockedUserIds ?? []), targetUid];
      await updateDoc(doc(getDb(), "users", user.uid), { blockedUserIds: next });
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`mt-3 w-full text-xs px-3 py-2 rounded-pill border transition-colors ${
        isBlocked
          ? "border-[var(--color-line)] text-[var(--color-ink-muted)] hover:bg-[var(--color-cream-2)]"
          : "border-[var(--color-brick)]/40 text-[var(--color-brick)] hover:bg-[var(--color-brick-soft)]/40"
      }`}
    >
      {isBlocked ? "✓ Blocked — tap to unblock" : "Block this user"}
    </button>
  );
}

function PublicProfileWithParams() {
  const search = useSearchParams();
  const id = search.get("id");
  if (!id) {
    return (
      <p>
        No worker selected.{" "}
        <Link href="/find-work" className="underline">Browse open jobs</Link>.
      </p>
    );
  }
  return <PublicProfileInner uid={id} />;
}

export default function PublicProfilePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-14 max-w-5xl">
          <Suspense fallback={<p className="text-[var(--color-ink-muted)]">Loading…</p>}>
            <PublicProfileWithParams />
          </Suspense>
        </Container>
      </main>
      <Footer />
    </>
  );
}
