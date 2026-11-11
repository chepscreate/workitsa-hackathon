"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import { StarsInput, StarsRead } from "@/components/Stars";
import { JobDetailSkeleton } from "@/components/Skeleton";
import EmergencyButton from "@/components/EmergencyButton";
import EmployerTrust from "@/components/EmployerTrust";
import ShareWithContact from "@/components/ShareWithContact";
import TrustedContactArm from "@/components/TrustedContactArm";
import JobMessages from "@/components/JobMessages";
import { LiveLocationView, WorkerLocationControls } from "@/components/LocationShare";
import Avatar from "@/components/Avatar";
import ReputationBadges from "@/components/ReputationBadges";
import PhotoUploader from "@/components/PhotoUploader";
import Confetti from "@/components/Confetti";
import WhatsAppShare from "@/components/WhatsAppShare";
import JobDetailLayout from "@/components/JobDetailLayout";
import DisputeButton from "@/components/DisputeButton";
import PaymentHandshakeCard from "@/components/PaymentHandshakeCard";
import DisputeBanner from "@/components/DisputeBanner";
import ReportButton from "@/components/ReportButton";
import { useConfirm } from "@/contexts/ConfirmContext";
import { PhotoGrid } from "@/components/ImageLightbox";
import { recordView } from "@/lib/recently-viewed";
import { ALL_BADGES } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  acceptOffer,
  boostJob,
  cancelJobRecurrence,
  confirmCompletionByEmployer,
  createOffer,
  getJobStartPin,
  leaveJob,
  markCompletedByWorker,
  markEnRoute,
  markInProgress,
  rebookJob,
  removeWorkerFromCrew,
  setCrewSize,
  setJobRecurrence,
  setRequireStartPin,
  submitRating,
  verifyJobStartPin,
  subscribeJob,
  subscribeMyOfferForJob,
  subscribeOffersForJob,
  updateJob,
  updateOffer,
} from "@/lib/jobs";
import {
  CATEGORIES,
  RECURRENCE_OPTIONS,
  activeCrew,
  crewProgress,
  isBoosted,
  isCrewJob,
  recurrenceLabel,
  type AssignedWorker,
  type Job,
  type Offer,
  type RecurrenceFrequency,
} from "@/lib/types";
import { rankOffers } from "@/lib/matching";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

function categoryLabel(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/**
 * "Boost this job" — monetization (featured listings). Pins the job to the top
 * of the worker feed + a Boosted badge. FREE during launch; a paywall wraps the
 * boostJob() call later.
 */
function BoostCard({ job }: { job: Job }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const boosted = isBoosted(job);
  const daysLeft = job.boostedUntil
    ? Math.max(1, Math.ceil((job.boostedUntil - Date.now()) / 86_400_000))
    : 0;

  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      await boostJob(job.id, 7);
    } catch {
      setErr("Couldn't boost just now — please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (boosted) {
    return (
      <section className="mt-6 rounded-2xl p-5 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="font-display text-lg text-[var(--color-ink)]">✦ Boosted to the top</p>
          <p className="text-sm text-[var(--color-ink-soft)]">
            Featured in the worker feed for {daysLeft} more day{daysLeft === 1 ? "" : "s"}.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={go} loading={busy} loadingText="Extending…">
          Extend +7 days
        </Button>
      </section>
    );
  }
  return (
    <section className="mt-6 rounded-2xl p-5 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-display text-lg text-[var(--color-ink)]">✦ Boost this job</h3>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)] max-w-md">
            Pin it to the top of the worker feed with a Boosted badge — more eyes,
            faster offers. <b className="text-[var(--color-ink)]">Free during launch.</b>
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={go} loading={busy} loadingText="Boosting…">
          Boost — free
        </Button>
      </div>
      {err && <p className="mt-3 text-sm text-[var(--color-brick)]">{err}</p>}
    </section>
  );
}

/**
 * "Book again" — shown to the employer on a confirmed job. Re-posts the same
 * job (priced at what was actually paid) and, by default, invites the worker /
 * crew who did it. The retention loop for repeat work like cleaning & gardening.
 */
function RebookCard({ job }: { job: Job }) {
  const router = useRouter();
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [freq, setFreq] = useState<RecurrenceFrequency>("weekly");
  const [recurBusy, setRecurBusy] = useState(false);
  const [recurErr, setRecurErr] = useState<string | null>(null);
  if (!profile) return null;

  const crew = isCrewJob(job);
  const hadWorker = crew ? activeCrew(job).length > 0 : !!job.assignedWorkerId;
  const price = job.agreedPrice ?? job.suggestedPrice;
  const firstName = job.assignedWorkerName?.split(" ")[0];
  const recurrence = job.recurrence;
  const repeating = !!recurrence?.active;

  const go = async (invite: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const newId = await rebookJob(job, profile, { inviteSameWorker: invite });
      router.push(`/jobs?id=${newId}`);
    } catch {
      setErr("Couldn't rebook just now — please try again.");
      setBusy(false);
    }
  };

  const startRecurring = async () => {
    setRecurBusy(true);
    setRecurErr(null);
    try {
      await setJobRecurrence(job.id, freq, hadWorker);
    } catch {
      setRecurErr("Couldn't set up auto-repeat — please try again.");
    } finally {
      setRecurBusy(false);
    }
  };

  const stopRecurring = async () => {
    setRecurBusy(true);
    setRecurErr(null);
    try {
      await cancelJobRecurrence(job.id);
    } catch {
      setRecurErr("Couldn't stop auto-repeat — please try again.");
    } finally {
      setRecurBusy(false);
    }
  };

  const inviteSuffix = hadWorker
    ? crew
      ? " and invite your crew back each time"
      : ` and invite ${firstName ?? "them"} back each time`
    : "";

  return (
    <section className="rounded-2xl p-5 sm:p-6 bg-[var(--color-cream-2)] border border-[var(--color-line)]">
      <h3 className="font-display text-xl text-[var(--color-ink)]">Need this done again?</h3>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        Re-post <span className="font-medium">{job.title}</span> in two taps
        {hadWorker
          ? crew
            ? " — your crew gets invited back first."
            : ` — ${firstName ?? "they"} gets invited back first.`
          : "."}{" "}
        Starts at R{price}; tweak anything before it goes live.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {hadWorker && (
          <Button
            onClick={() => go(true)}
            variant="primary"
            size="sm"
            loading={busy}
            loadingText="Booking…"
          >
            {crew ? "Book this crew again" : `Book ${firstName ?? "them"} again`}
          </Button>
        )}
        <Button
          onClick={() => go(false)}
          variant={hadWorker ? "outline" : "primary"}
          size="sm"
          disabled={busy}
        >
          Post a fresh copy
        </Button>
      </div>
      {err && <p className="mt-3 text-sm text-[var(--color-brick)]">{err}</p>}

      {/* Recurring auto-schedule */}
      <div className="mt-5 pt-5 border-t border-[var(--color-line)]">
        {repeating ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--color-ink)]">
              🔁 Repeats{" "}
              <span className="font-medium">
                {recurrenceLabel(recurrence!.frequency).toLowerCase()}
              </span>
              {recurrence!.nextRunAt
                ? ` · next on ${new Date(recurrence!.nextRunAt).toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}`
                : ""}
              {recurrence!.inviteSameWorker && hadWorker
                ? crew
                  ? " · crew re-invited"
                  : ` · ${firstName ?? "they"} re-invited`
                : ""}
            </p>
            <Button
              onClick={stopRecurring}
              variant="outline"
              size="sm"
              loading={recurBusy}
              loadingText="Stopping…"
            >
              Stop auto-repeat
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-[var(--color-ink)]">
              Or repeat it automatically
            </p>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              We&rsquo;ll post a fresh copy on a schedule{inviteSuffix}. Stop anytime.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {RECURRENCE_OPTIONS.map((o) => (
                <Button
                  key={o.id}
                  onClick={() => setFreq(o.id)}
                  variant={freq === o.id ? "primary" : "outline"}
                  size="sm"
                  disabled={recurBusy}
                >
                  {o.label}
                </Button>
              ))}
            </div>
            <div className="mt-3">
              <Button
                onClick={startRecurring}
                variant="primary"
                size="sm"
                loading={recurBusy}
                loadingText="Setting up…"
              >
                Turn on auto-repeat
              </Button>
            </div>
          </>
        )}
        {recurErr && <p className="mt-3 text-sm text-[var(--color-brick)]">{recurErr}</p>}
      </div>
    </section>
  );
}

/**
 * Doorstep start code (employer side). Shows the 4-digit code to read out to the
 * worker at the door, an arrival-verified indicator once they enter it, and a
 * toggle to turn the requirement off for jobs where the employer won't be present.
 * The code is fetched from a server callable — it never lives on the public job doc.
 */
function StartCodeCard({ job }: { job: Job }) {
  const required = !!job.requireStartPin;
  const crew = isCrewJob(job);
  const crewMembers = crew ? activeCrew(job) : [];
  const verifiedCount = crew
    ? crewMembers.filter((w) => w.startVerifiedAt).length
    : job.startVerifiedAt
      ? 1
      : 0;
  const totalCount = crew ? crewMembers.length : 1;
  const allVerified = totalCount > 0 && verifiedCount >= totalCount;

  const [pin, setPin] = useState<string | null>(null);
  const [loadingPin, setLoadingPin] = useState(false);
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);

  // Fetch (and lazily generate) the code while it's still needed.
  useEffect(() => {
    if (!required || allVerified) return;
    let cancelled = false;
    setLoadingPin(true);
    setPinErr(null);
    getJobStartPin(job.id)
      .then((p) => {
        if (!cancelled) setPin(p);
      })
      .catch((e) => {
        if (!cancelled) setPinErr(e instanceof Error ? e.message : "Couldn't load the code.");
      })
      .finally(() => {
        if (!cancelled) setLoadingPin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [required, allVerified, job.id]);

  const toggle = async (value: boolean) => {
    setToggleBusy(true);
    try {
      await setRequireStartPin(job.id, value);
    } finally {
      setToggleBusy(false);
    }
  };

  const firstName = job.assignedWorkerName?.split(" ")[0];
  const verifiedAtStr = job.startVerifiedAt
    ? new Date(job.startVerifiedAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <section className="mt-6 rounded-2xl p-5 sm:p-6 bg-[var(--color-cream-2)] border border-[var(--color-line)]">
      <h3 className="font-display text-xl text-[var(--color-ink)]">🔒 Start code</h3>

      {!required ? (
        <>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Add a doorstep code your {crew ? "workers" : "worker"} must enter to start — a
            quick way to confirm the right, verified person showed up. Recommended for jobs
            at your home.
          </p>
          <div className="mt-3">
            <Button
              onClick={() => toggle(true)}
              variant="primary"
              size="sm"
              loading={toggleBusy}
              loadingText="Saving…"
            >
              Require a start code
            </Button>
          </div>
        </>
      ) : allVerified ? (
        <p className="mt-1 text-sm text-[var(--color-ink)]">
          {crew
            ? `✓ All ${totalCount} workers entered the code.`
            : `✓ ${firstName ?? "Your worker"} entered the code${verifiedAtStr ? ` at ${verifiedAtStr}` : ""}.`}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Read this code to your {crew ? "workers" : "worker"} when they arrive — they
            enter it to start, which confirms the right person is at your door.
          </p>
          <div className="mt-3">
            {loadingPin ? (
              <span className="text-sm text-[var(--color-ink-muted)]">Loading…</span>
            ) : pin ? (
              <span className="font-display text-4xl tracking-[0.3em] tabular-nums text-[var(--color-ink)]">
                {pin}
              </span>
            ) : (
              <span className="text-sm text-[var(--color-brick)]">{pinErr ?? "—"}</span>
            )}
          </div>
          {crew && verifiedCount > 0 && (
            <p className="mt-2 text-xs text-[var(--color-ink)]">
              {verifiedCount} of {totalCount} have entered the code.
            </p>
          )}
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            Only you can see this. Don&apos;t send it in chat — say it in person.
          </p>
          <div className="mt-4">
            <Button
              onClick={() => toggle(false)}
              variant="ghost"
              size="sm"
              loading={toggleBusy}
              loadingText="Saving…"
            >
              Don&apos;t require a code
            </Button>
          </div>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            Turn off if you won&apos;t be there to share it (e.g. gardening while you&apos;re
            out, or a delivery).
          </p>
        </>
      )}
    </section>
  );
}

function JobDetailInner({ id }: { id: string }) {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const confirm = useConfirm();

  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [myOfferDirect, setMyOfferDirect] = useState<Offer | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [milestone, setMilestone] = useState<string | null>(null);

  const reload = async () => {};

  // Milestone confetti — fires once per browser per job for two events:
  // 1) Worker viewing their first-ever confirmed job (job-done celebration)
  // 2) Worker receiving a 5★ rating from the employer
  useEffect(() => {
    if (!job || !user || !profile) return;
    if (profile.uid !== job.assignedWorkerId) return; // worker only
    if (typeof window === "undefined") return;

    const seenKey = `workit_milestone_${job.id}`;
    const seen = JSON.parse(window.localStorage.getItem(seenKey) ?? "{}") as
      Record<string, boolean>;

    let fired: string | null = null;
    if (job.status === "confirmed" && !seen.confirmed) {
      fired = "Job confirmed — payday vibes 🎉";
      seen.confirmed = true;
    }
    if (job.employerRating?.stars === 5 && !seen.fiveStar) {
      fired = `5★ from ${job.employerName}! 🌟`;
      seen.fiveStar = true;
    }
    if (fired) {
      window.localStorage.setItem(seenKey, JSON.stringify(seen));
      setMilestone(fired);
      setCelebrate(true);
      const t = setTimeout(() => {
        setCelebrate(false);
        setMilestone(null);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [job, user, profile]);

  // Job doc is publicly readable (rules) — no auth gate on the subscription
  useEffect(() => {
    recordView(id);
    const unsub = subscribeJob(id, (j) => setJob(j));
    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!user || !job) return;
    const canRead = job.employerId === user.uid || job.assignedWorkerId === user.uid;
    if (!canRead) {
      setOffers([]);
      return;
    }
    const unsub = subscribeOffersForJob(id, (list) => setOffers(list));
    return () => unsub();
  }, [id, user, job]);

  // Workers browsing the job: subscribe to their own offer (if any) so the
  // form hides after submission and we can show their offer status.
  useEffect(() => {
    if (!user || !job) return;
    const isParty = job.employerId === user.uid || job.assignedWorkerId === user.uid;
    if (isParty) {
      setMyOfferDirect(null);
      return;
    }
    const unsub = subscribeMyOfferForJob(id, user.uid, (offer) =>
      setMyOfferDirect(offer),
    );
    return () => unsub();
  }, [id, user, job]);

  if (job === undefined) {
    return <JobDetailSkeleton />;
  }
  if (job === null) {
    return <p>Job not found.</p>;
  }

  const crew = activeCrew(job);
  const myCrewEntry: AssignedWorker | undefined = crew.find((w) => w.uid === profile?.uid);
  const isSignedIn = !!user;
  const isEmployer = isSignedIn && profile?.uid === job.employerId;
  const isAssignedWorker =
    isSignedIn
    && (profile?.uid === job.assignedWorkerId || (isCrewJob(job) && !!myCrewEntry));
  const isWorkerBrowsing = isSignedIn && !isEmployer && !isAssignedWorker;
  const { filled, needed, remaining } = crewProgress(job);
  const isGuest = !isSignedIn;
  const isParty = isEmployer || isAssignedWorker;
  const isDisputed = job.status === "disputed";
  // After a job is assigned (any active state), either party may flag a
  // problem until it's confirmed / cancelled / already disputed.
  const canRaiseDispute =
    isParty
    && profile
    && ["assigned", "in_progress", "completed"].includes(job.status);
  // For employer/assigned: use offers from full list. For browsing worker:
  // use the dedicated subscription (rules block the full list for them).
  const myOffer = isWorkerBrowsing
    ? myOfferDirect ?? undefined
    : offers.find((o) => o.workerId === profile?.uid);

  return (
    <JobDetailLayout
      job={job}
      employer={{
        name: job.employerName,
        photoURL: job.employerPhotoURL,
      }}
    >
      <Link href="/find-work" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
        ← Back to jobs
      </Link>

      {milestone && (
        <div className="relative mt-4 rounded-2xl p-5 bg-gradient-to-r from-[var(--color-ochre-500)] to-[var(--color-sage-600)] text-[var(--color-cream)] shadow-lift animate-pop-in overflow-hidden">
          <Confetti active={celebrate} />
          <p className="font-display text-xl sm:text-2xl text-center">
            {milestone}
          </p>
        </div>
      )}

      <div className="mt-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone="ochre">{categoryLabel(job.category)}</Badge>
          <StatusBadge status={job.status} />
          {isCrewJob(job) && (
            <Badge tone="sage">Crew · {filled}/{needed} hired</Badge>
          )}
        </div>
        <h1 className="mt-3 font-display text-3xl sm:text-4xl tracking-tight leading-tight">
          {job.title}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          {job.suburb}, {job.city}, {job.province} · Posted by{" "}
          {job.employerIsBusiness ? (
            <Link
              href={`/business?id=${job.employerId}`}
              className="underline decoration-[var(--color-ochre-500)] underline-offset-2 hover:text-[var(--color-ink)]"
            >
              {job.employerName}
            </Link>
          ) : (
            job.employerName
          )}
        </p>
        {job.agreedPrice && (
          <p className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-pill text-xs font-medium border bg-[var(--color-sage-100)] text-[var(--color-sage-700)] border-[var(--color-sage-400)]">
            Agreed: R {job.agreedPrice}
          </p>
        )}
      </div>

      <section className="mt-8 rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
        <h2 className="font-display text-xl mb-2">Description</h2>
        <p className="text-[var(--color-ink-soft)] whitespace-pre-wrap leading-relaxed">
          {job.description}
        </p>

        <JobSpecs job={job} />
        {job.completionPhotoURLs && job.completionPhotoURLs.length > 0 ? (
          // Once there's completion proof, frame the job's photos as a structured
          // before → after so the finished work reads at a glance.
          <div className="mt-6 pt-5 border-t border-[var(--color-line)]">
            <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] mb-3">
              Proof of work
            </p>
            <div className="grid sm:grid-cols-2 gap-5">
              {job.photoURLs && job.photoURLs.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--color-ink-soft)] mb-2">Before</p>
                  <PhotoGrid urls={job.photoURLs} />
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-[var(--color-sage-700)] mb-2">After ✓</p>
                <PhotoGrid urls={job.completionPhotoURLs} />
              </div>
            </div>
          </div>
        ) : (
          job.photoURLs && job.photoURLs.length > 0 && (
            <div className="mt-5">
              <PhotoGrid urls={job.photoURLs} />
            </div>
          )
        )}
      </section>

      {error && (
        <p className="mt-4 text-sm text-[var(--color-brick)]">{error}</p>
      )}

      {/* Deadline banner — visible to everyone when set and the job isn't done yet */}
      {typeof job.dueAt === "number"
        && job.status !== "confirmed"
        && job.status !== "cancelled"
        && (() => {
          const now = Date.now();
          const overdue = job.dueAt < now;
          const within24h = !overdue && job.dueAt - now < 24 * 60 * 60 * 1000;
          if (!overdue && !within24h) return null;
          const label = new Date(job.dueAt).toLocaleString("en-ZA", {
            weekday: "long",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <div
              className={`mt-4 rounded-xl p-4 text-sm flex items-start gap-3 ${
                overdue
                  ? "bg-[var(--color-brick-soft)] border border-[var(--color-brick)]/40 text-[var(--color-brick)]"
                  : "bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] text-[var(--color-ink-soft)]"
              }`}
            >
              <span aria-hidden className="text-lg">⏰</span>
              <span>
                {overdue ? (
                  <>
                    <b>This job is overdue.</b> It was due {label}. If it&apos;s no
                    longer needed, the employer can cancel it.
                  </>
                ) : (
                  <>
                    <b>Deadline soon — due {label}.</b> Workers, factor this into
                    your offer before sending it.
                  </>
                )}
              </span>
            </div>
          );
        })()}

      {/* DISPUTE BANNER — visible to everyone whenever active */}
      {isDisputed && job.dispute && <DisputeBanner dispute={job.dispute} />}

      {/* WHATSAPP SHARE — open jobs only, visible to everyone */}
      {job.status === "open" && (
        <section className="mt-6 rounded-2xl p-5 bg-[var(--color-cream-2)] border border-[var(--color-line)]">
          <p className="text-sm font-medium text-[var(--color-ink)]">
            Know someone who could do this job?
          </p>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)] mb-3">
            One tap shares it on WhatsApp — they don&apos;t need an account to
            view the link.
          </p>
          <WhatsAppShare
            variant="button"
            text={`Workit — ${job.title} · R${job.suggestedPrice} in ${job.suburb}`}
            url={`${
              process.env.NEXT_PUBLIC_SITE_URL ?? "https://workitsa.co.za"
            }/jobs/?id=${job.id}`}
          />
        </section>
      )}

      {/* GUEST CTA — non-signed-in visitor on an open job */}
      {isGuest && job.status === "open" && (
        <section className="mt-6 rounded-2xl p-7 bg-[var(--color-ochre-500)] text-[var(--color-cream)] shadow-lift text-center">
          <h2 className="font-display text-2xl sm:text-3xl tracking-tight">
            Want to do this job?
          </h2>
          <p className="mt-2 text-sm text-[var(--color-cream)]/90 max-w-md mx-auto">
            Free to sign up. You&apos;ll send the employer your price and they
            pick who they trust.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
            <Link
              href="/signup?role=worker"
              className="px-6 py-3 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] font-medium hover:opacity-90"
            >
              Sign up as a worker
            </Link>
            <Link
              href={`/signin?next=/jobs?id=${job.id}`}
              className="px-6 py-3 rounded-pill border border-[var(--color-cream)]/40 text-[var(--color-cream)] font-medium hover:bg-white/10"
            >
              Already have an account?
            </Link>
          </div>
        </section>
      )}
      {isGuest && job.status !== "open" && (
        <section className="mt-6 rounded-2xl p-6 bg-[var(--color-cream-2)] border border-[var(--color-line)] text-center text-sm text-[var(--color-ink-soft)]">
          This job isn&apos;t open for offers right now.{" "}
          <Link href="/find-work" className="underline">
            Browse other open jobs
          </Link>
          .
        </section>
      )}

      {isCrewJob(job) && (isWorkerBrowsing || isGuest) && job.status === "open" && (
        <div className="mt-6 rounded-2xl p-5 bg-[var(--color-sage-100)]/30 border border-[var(--color-sage-400)]/50 text-sm text-[var(--color-ink-soft)] flex items-center justify-between gap-3 flex-wrap">
          <span>
            <b className="text-[var(--color-ink)]">{filled}</b> of{" "}
            <b className="text-[var(--color-ink)]">{needed}</b> workers hired so
            far — <b className="text-[var(--color-sage-700)]">{remaining}</b>{" "}
            spot{remaining === 1 ? "" : "s"} still open.
          </span>
          <div className="flex-1 max-w-[160px] h-2 rounded-full bg-[var(--color-cream-2)] overflow-hidden">
            <div
              className="h-full bg-[var(--color-sage-600)] transition-all"
              style={{ width: `${(filled / needed) * 100}%` }}
            />
          </div>
        </div>
      )}
      {/* Who you'd be working for — employer accountability before you go. */}
      {isSignedIn && !isEmployer && <EmployerTrust job={job} />}

      {isWorkerBrowsing && myOfferDirect === undefined && (
        <div className="mt-6 h-24 rounded-2xl bg-[var(--color-cream-2)] animate-pulse" />
      )}
      {isWorkerBrowsing && myOfferDirect === null && job.status === "open" && (
        <OfferForm
          jobId={job.id}
          suggestedPrice={job.suggestedPrice}
          onSubmitted={async () => {
            setCelebrate(true);
            setTimeout(() => setCelebrate(false), 1100);
          }}
          setBusy={setBusy}
          setError={setError}
          busy={busy}
        />
      )}
      {isWorkerBrowsing && myOffer && (
        <div className="relative animate-pop-in mt-6">
          <Confetti active={celebrate} />
          <div className="rounded-2xl p-5 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
                  Your offer
                </p>
                <p className="mt-1 font-display text-2xl text-[var(--color-ochre-600)]">
                  R {myOffer.price}
                </p>
              </div>
              {(() => {
                const map = {
                  pending: { tone: "ochre" as const, label: "⏳ Pending approval" },
                  accepted: { tone: "sage" as const, label: "✓ Accepted" },
                  rejected: { tone: "brick" as const, label: "Not chosen" },
                  withdrawn: { tone: "stone" as const, label: "Withdrawn" },
                };
                const m = map[myOffer.status] ?? map.pending;
                return <Badge tone={m.tone}>{m.label}</Badge>;
              })()}
            </div>
            <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
              {myOffer.status === "pending"
                ? "Waiting for the employer to review. You'll get a notification the moment they decide — no need to refresh."
                : myOffer.status === "accepted"
                  ? "You got the job! Open it from your account to chat, share your location, and mark it done when finished."
                  : myOffer.status === "rejected"
                    ? "The employer went with someone else this time. Plenty more jobs on the board — keep offering."
                    : "You withdrew this offer."}
            </p>
          </div>
        </div>
      )}
      {isWorkerBrowsing && job.status !== "open" && !myOffer && (
        <Notice>This job is no longer accepting offers.</Notice>
      )}

      {isEmployer && job.status === "open" && <BoostCard job={job} />}

      {isEmployer && (
        <div className="relative">
          <Confetti active={celebrate} />
          <EmployerControls
            job={job}
            offers={offers}
            onChange={async () => {
              setCelebrate(true);
              setTimeout(() => setCelebrate(false), 1100);
            }}
            setBusy={setBusy}
            setError={setError}
            busy={busy}
          />
        </div>
      )}

      {/* Doorstep start code — employer reads it to the worker at the door. */}
      {isEmployer && (job.status === "assigned" || job.status === "in_progress") && (
        <StartCodeCard job={job} />
      )}

      {isAssignedWorker && profile && (
        <WorkerLifecycle
          job={job}
          myCrewEntry={myCrewEntry}
          myUid={profile.uid}
          onChange={reload}
          setBusy={setBusy}
          setError={setError}
          busy={busy}
        />
      )}

      {/* Payment handshake — crew worker's own slot, once confirmed. */}
      {isAssignedWorker && isCrewJob(job) && myCrewEntry?.status === "confirmed" && (
        <PaymentHandshakeCard
          job={job}
          asEmployer={false}
          worker={myCrewEntry}
          setBusy={setBusy}
          setError={setError}
          busy={busy}
        />
      )}

      {/* Crew worker rates the employer once their own slot is confirmed. */}
      {isAssignedWorker && isCrewJob(job) && myCrewEntry?.status === "confirmed" && (
        <CrewWorkerRating
          job={job}
          worker={myCrewEntry}
          asEmployer={false}
          setBusy={setBusy}
          setError={setError}
          busy={busy}
        />
      )}

      {/* Payment handshake — single-worker job, once the work is confirmed. */}
      {!isCrewJob(job) && job.status === "confirmed" && (isEmployer || isAssignedWorker) && (
        <PaymentHandshakeCard
          job={job}
          asEmployer={isEmployer}
          setBusy={setBusy}
          setError={setError}
          busy={busy}
        />
      )}

      {/* Legacy single-worker rating (employer ↔ single assigned worker). */}
      {!isCrewJob(job) && job.status === "confirmed" && (isEmployer || isAssignedWorker) && (
        <RatingSection
          job={job}
          asEmployer={isEmployer}
          onRated={reload}
          setBusy={setBusy}
          setError={setError}
          busy={busy}
        />
      )}

      {/* "Book again" — re-hire the same worker/crew for a repeat job in two taps. */}
      {isEmployer && job.status === "confirmed" && <RebookCard job={job} />}

      {/* Active-job safety features: messaging, location, emergency.
          Stay available during disputes so both sides can still talk.
          For crew jobs, "active" is decided per-worker for the assigned-worker view. */}
      {/* Messaging only appears once the employer has actually hired someone —
          a crew job with ≥1 accepted worker, or a single job in an assigned+
          state. Before that there's no one to chat with, so we don't show it
          on open jobs. */}
      {(() => {
        const hasHired = isCrewJob(job)
          ? activeCrew(job).length > 0
          : ["assigned", "in_progress", "completed", "disputed"].includes(job.status);
        const workerCanMessage =
          isAssignedWorker
          && (isCrewJob(job)
            ? !!myCrewEntry && ["assigned", "in_progress", "completed"].includes(myCrewEntry.status)
            : ["assigned", "in_progress", "completed", "disputed"].includes(job.status));
        return (isEmployer && hasHired) || workerCanMessage;
      })()
        && profile && (
          <>
            <JobMessages
              jobId={job.id}
              me={profile}
              otherName={
                isCrewJob(job)
                  ? (isEmployer ? `Crew (${activeCrew(job).length})` : `${job.employerName} + crew`)
                  : (isEmployer ? (job.assignedWorkerName ?? "Worker") : job.employerName)
              }
            />
            {/* Live location is single-pin today; hide it for crews until per-worker tracking ships. */}
            {!isCrewJob(job) && isAssignedWorker && !isDisputed && <WorkerLocationControls job={job} />}
            {!isCrewJob(job) && isEmployer && !isDisputed && <LiveLocationView job={job} />}
            {!isDisputed && (
              <ShareWithContact
                job={job}
                role={isEmployer ? "employer" : "worker"}
                myName={profile.displayName}
              />
            )}
            <EmergencyButton
              jobId={job.id}
              uid={profile.uid}
              name={profile.displayName}
              role={isEmployer ? "employer" : "worker"}
            />
          </>
        )}

      {/* DISPUTE TRIGGER — only on active jobs, not when already disputed */}
      {canRaiseDispute && profile && (
        <div className="mt-6 text-right">
          <DisputeButton job={job} me={profile} />
        </div>
      )}

      {/* Report — visible to anyone who isn't the employer (employers own the
          job and can just cancel it; bad-content reports come from the other
          side). Sits at the very bottom so it's the last resort, not the
          first thing people see. */}
      {!isEmployer && (
        <div className="mt-10 pt-6 border-t border-[var(--color-line)] flex items-center justify-between gap-3 text-xs text-[var(--color-ink-muted)]">
          <span>Something feel wrong about this job?</span>
          <ReportButton
            targetType="job"
            targetId={job.id}
            targetUserUid={job.employerId}
            label="Report this job"
          />
        </div>
      )}

      {isEmployer && job.status === "open" && (
        <button
          type="button"
          onClick={async () => {
            const ok = await confirm({
              title: "Cancel this job?",
              body: "Workers who've sent offers will see this is no longer open. You can post it again later.",
              tone: "danger",
              confirmLabel: "Yes, cancel job",
              cancelLabel: "Keep it open",
            });
            if (!ok) return;
            setBusy(true);
            try {
              await updateJob(job.id, { status: "cancelled" });
              router.push("/account");
            } finally {
              setBusy(false);
            }
          }}
          className="mt-6 text-sm text-[var(--color-brick)] hover:underline"
        >
          Cancel this job
        </button>
      )}
    </JobDetailLayout>
  );
}

function JobDetailWithParams() {
  const search = useSearchParams();
  const id = search.get("id");
  if (!id) {
    return (
      <p>
        No job selected.{" "}
        <Link href="/find-work" className="underline">
          Browse open jobs
        </Link>
        .
      </p>
    );
  }
  return <JobDetailInner id={id} />;
}

export default function JobDetailPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Wider container so the 2-col JobDetailLayout (left job body,
            right sticky action/employer card) has room to breathe. */}
        <Container className="py-10 lg:py-14">
          <Suspense fallback={<p className="text-[var(--color-ink-muted)]">Loading…</p>}>
            <JobDetailWithParams />
          </Suspense>
        </Container>
      </main>
      <Footer />
    </>
  );
}

/** Compact specs strip on the job detail page — only shows rows that have data. */
function JobSpecs({ job }: { job: Job }) {
  const rows: Array<{ label: string; value: React.ReactNode }> = [];

  if (job.toolsProvided) {
    const map: Record<string, string> = {
      employer: "Employer provides tools",
      worker: "Worker brings own tools",
      shared: "Some of each",
      na: "No tools needed",
    };
    rows.push({ label: "Tools", value: map[job.toolsProvided] ?? job.toolsProvided });
  }
  if (job.experienceLevel) {
    const map: Record<string, string> = {
      any: "Open to anyone",
      some: "Some experience",
      experienced: "Experienced only",
    };
    rows.push({ label: "Experience", value: map[job.experienceLevel] ?? job.experienceLevel });
  }
  if (job.transportIncluded) {
    rows.push({ label: "Transport", value: "✓ Included" });
  }
  if (job.trainingProvided) {
    rows.push({ label: "Training", value: "✓ Provided — newcomers welcome" });
  }
  if (typeof job.estimatedHours === "number" && job.estimatedHours > 0) {
    const unit = job.estimatedUnit ?? "hours";
    const singular = unit === "days" ? "day" : "hour";
    rows.push({
      label: "Duration",
      value: `~${job.estimatedHours} ${singular}${job.estimatedHours === 1 ? "" : "s"}`,
    });
  }
  if (job.paymentMethod) {
    rows.push({
      label: "Payment",
      value: job.paymentMethod === "eft" ? "EFT on completion" : "Cash on completion",
    });
  }
  if (typeof job.dueAt === "number") {
    const overdue = job.dueAt < Date.now();
    const label = new Date(job.dueAt).toLocaleString("en-ZA", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    rows.push({
      label: "Due by",
      value: (
        <span className={overdue ? "text-[var(--color-brick)]" : undefined}>
          {label}
          {overdue && " · overdue"}
        </span>
      ),
    });
  }
  if (job.workerPreference) {
    const p = job.workerPreference;
    const parts: string[] = [];
    if (p.gender && p.gender !== "any") {
      parts.push(p.gender === "female" ? "Female" : "Male");
    }
    if (p.ageMin && p.ageMax) parts.push(`${p.ageMin}–${p.ageMax} yrs`);
    else if (p.ageMin) parts.push(`${p.ageMin}+ yrs`);
    else if (p.ageMax) parts.push(`under ${p.ageMax} yrs`);
    if (parts.length > 0) {
      rows.push({
        label: "Preference",
        value: (
          <span title="A preference, not a requirement — anyone can offer.">
            {parts.join(" · ")} <span className="text-[var(--color-ink-muted)]">(preferred)</span>
          </span>
        ),
      });
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="mt-5 pt-5 border-t border-[var(--color-line)]">
      <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold mb-3">
        At a glance
      </p>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-3 py-1 border-b border-[var(--color-line)]/50">
            <dt className="text-[var(--color-ink-muted)]">{r.label}</dt>
            <dd className="text-[var(--color-ink)] font-medium text-right">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TrustChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-pill transition-colors ${
        active
          ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
          : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: Job["status"] }) {
  const map: Record<Job["status"], { tone: "sage" | "ochre" | "ink" | "stone" | "brick"; label: string }> = {
    open: { tone: "sage", label: "Open" },
    assigned: { tone: "ochre", label: "Assigned" },
    in_progress: { tone: "ochre", label: "In progress" },
    completed: { tone: "ink", label: "Awaiting confirmation" },
    confirmed: { tone: "sage", label: "Completed" },
    disputed: { tone: "brick", label: "Disputed" },
    cancelled: { tone: "stone", label: "Cancelled" },
  };
  const m = map[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

function Notice({
  children,
  tone = "stone",
}: {
  children: React.ReactNode;
  tone?: "stone" | "sage" | "ochre";
}) {
  const cls =
    tone === "sage"
      ? "bg-[var(--color-sage-100)]/40 border-[var(--color-sage-400)]/50"
      : tone === "ochre"
        ? "bg-[var(--color-ochre-50)] border-[var(--color-ochre-300)]"
        : "bg-[var(--color-cream-2)] border-[var(--color-line)]";
  return (
    <div className={`mt-6 rounded-xl p-5 border text-sm text-[var(--color-ink-soft)] ${cls}`}>
      {children}
    </div>
  );
}

function OfferForm({
  jobId,
  suggestedPrice,
  onSubmitted,
  setBusy,
  setError,
  busy,
}: {
  jobId: string;
  suggestedPrice: number;
  onSubmitted: () => Promise<void>;
  setBusy: (b: boolean) => void;
  setError: (s: string | null) => void;
  busy: boolean;
}) {
  const { profile } = useAuth();
  const [price, setPrice] = useState(String(suggestedPrice));
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"accept" | "counter">("accept");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!profile) return;
    const p = mode === "accept" ? suggestedPrice : Number(price);
    if (!Number.isFinite(p) || p <= 0) {
      setError("Price must be a positive number.");
      return;
    }
    setBusy(true);
    try {
      await createOffer({
        jobId,
        worker: profile,
        price: p,
        message: message || undefined,
      });
      await onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send offer.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft space-y-4"
    >
      <h2 className="font-display text-xl">Respond to this job</h2>

      <div className="grid grid-cols-2 gap-2 p-1 rounded-pill bg-[var(--color-cream-2)] border border-[var(--color-line)]">
        <ModeBtn active={mode === "accept"} onClick={() => setMode("accept")}>
          Accept R {suggestedPrice}
        </ModeBtn>
        <ModeBtn active={mode === "counter"} onClick={() => setMode("counter")}>
          Counter-offer
        </ModeBtn>
      </div>

      {mode === "counter" && (
        <Input
          label="Your price (R)"
          name="price"
          type="number"
          min={1}
          step="any"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />
      )}

      <Textarea
        label="Message (optional)"
        name="message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="When you can do it, any questions, why you're a good fit…"
        rows={3}
      />

      <Button type="submit" size="lg" variant="primary" className="w-full" loading={busy} loadingText="Sending…">
        Send offer
      </Button>
    </form>
  );
}

function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-pill px-4 py-2 text-sm transition-all ${
        active
          ? "bg-[var(--color-paper)] shadow-soft text-[var(--color-ink)]"
          : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function EmployerControls({
  job,
  offers,
  onChange,
  setBusy,
  setError,
  busy,
}: {
  job: Job;
  offers: Offer[];
  onChange: () => Promise<void>;
  setBusy: (b: boolean) => void;
  setError: (s: string | null) => void;
  busy: boolean;
}) {
  const pending = offers.filter((o) => o.status === "pending");
  const confirm = useConfirm();
  const [offerTrustFilter, setOfferTrustFilter] = useState<"all" | "verified" | "gold">("all");
  const crew = activeCrew(job);
  const { filled, needed, remaining } = crewProgress(job);
  const crewMode = isCrewJob(job);

  const onAccept = async (offer: Offer) => {
    const afterFilled = filled + 1;
    const ok = await confirm({
      title: `Accept ${offer.workerName}'s offer?`,
      body: (
        <>
          You&apos;ll agree to pay <b>R {offer.price}</b>{" "}
          {job.paymentMethod === "eft" ? "by EFT" : "in cash"} on completion.
          {crewMode ? (
            afterFilled >= needed ? (
              <>
                {" "}This fills your crew ({needed}/{needed}). The job will
                close to new offers and other pending offers will be politely
                declined.
              </>
            ) : (
              <>
                {" "}After this, <b>{afterFilled} of {needed}</b> workers will
                be hired — the job stays open until the rest of the crew is
                filled.
              </>
            )
          ) : (
            <> Other workers&apos; pending offers will be politely declined.</>
          )}
        </>
      ),
      tone: "success",
      confirmLabel: "Yes, accept",
      cancelLabel: "Not yet",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await acceptOffer(job.id, offer);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept.");
    } finally {
      setBusy(false);
    }
  };

  const onReject = async (offer: Offer) => {
    setBusy(true);
    try {
      await updateOffer(job.id, offer.id, { status: "rejected" });
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  /** Single-worker confirm (legacy). */
  const onConfirmDone = async () => {
    const ok = await confirm({
      title: "Confirm the job is complete?",
      body: "This unlocks rating for both sides. Only do this if the work is done to your satisfaction.",
      tone: "success",
      confirmLabel: "Yes, it's done",
      cancelLabel: "Not yet",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await confirmCompletionByEmployer(job.id);
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  /** Crew: confirm one specific worker's portion. */
  const onConfirmWorker = async (w: AssignedWorker) => {
    const ok = await confirm({
      title: `Confirm ${w.name}'s portion is done?`,
      body: `Pay them R ${w.agreedPrice} and unlock the rating step for this one worker. Other crew members keep their own lifecycle.`,
      tone: "success",
      confirmLabel: "Yes, confirm",
      cancelLabel: "Not yet",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await confirmCompletionByEmployer(job.id, w.uid);
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  /** Crew: remove a worker from the roster — slot auto-reopens. */
  const onRemoveWorker = async (w: AssignedWorker) => {
    const ok = await confirm({
      title: `Remove ${w.name} from the crew?`,
      body: "Their slot will reopen so other workers can offer. They won't be paid for this job unless you confirm them first.",
      tone: "danger",
      confirmLabel: "Remove",
      cancelLabel: "Keep them",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await removeWorkerFromCrew(job.id, w.uid);
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  /** Crew: shrink the crew size to whatever's currently filled (close the gap). */
  const onCloseCrewGap = async () => {
    if (filled === 0) return;
    const ok = await confirm({
      title: `Run with ${filled} worker${filled === 1 ? "" : "s"} instead of ${needed}?`,
      body: "The job stops accepting offers and any pending offers are politely declined.",
      tone: "neutral",
      confirmLabel: "Yes, close intake",
      cancelLabel: "Keep looking",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await setCrewSize(job.id, filled);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update crew size.");
    } finally {
      setBusy(false);
    }
  };

  // Trust filters: employer can narrow offers to Verified-only or Gold-only.
  // Persists per-session in component state — no need to write to Firestore.
  const verifiedOnlyOffers = pending.filter((o) => o.workerVerified);
  const goldOnlyOffers = pending.filter((o) => o.backgroundVerified);
  const filteredOffers =
    offerTrustFilter === "verified"
      ? verifiedOnlyOffers
      : offerTrustFilter === "gold"
        ? goldOnlyOffers
        : pending;
  // Rank best-match first (verification, rating, track record, price) so the
  // employer sees the strongest candidate at the top — not just the newest.
  const shownOffers = rankOffers(filteredOffers, job);

  return (
    <section className="mt-8">
      {job.status === "open" && (
        <>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div>
              <h2 className="font-display text-2xl">
                Offers ({shownOffers.length}
                {shownOffers.length !== pending.length ? ` of ${pending.length}` : ""})
              </h2>
              {shownOffers.length >= 2 && (
                <p className="text-xs text-[var(--color-ink-muted)] mt-0.5">
                  Sorted by best match — verification, rating &amp; price.
                </p>
              )}
            </div>
            {pending.length > 0 && (
              <div className="flex gap-1 p-1 rounded-pill bg-[var(--color-cream-2)] border border-[var(--color-line)] text-xs">
                <TrustChip active={offerTrustFilter === "all"} onClick={() => setOfferTrustFilter("all")}>
                  All
                </TrustChip>
                <TrustChip active={offerTrustFilter === "verified"} onClick={() => setOfferTrustFilter("verified")}>
                  ✓ Verified ({verifiedOnlyOffers.length})
                </TrustChip>
                <TrustChip active={offerTrustFilter === "gold"} onClick={() => setOfferTrustFilter("gold")}>
                  🥇 Gold ({goldOnlyOffers.length})
                </TrustChip>
              </div>
            )}
          </div>
          {shownOffers.length === 0 ? (
            <Notice>
              {pending.length === 0
                ? "No offers yet. Workers nearby will see this shortly."
                : `No ${offerTrustFilter} offers yet. ${pending.length} total — switch back to All to see them.`}
            </Notice>
          ) : (
            <ul className="space-y-3">
              {shownOffers.map((o, idx) => (
                <li
                  key={o.id}
                  className="rounded-xl p-5 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft flex items-start gap-4 flex-wrap animate-slide-up"
                >
                  {idx === 0 && shownOffers.length >= 2 && (
                    <div className="w-full">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-medium bg-[var(--color-ochre-50)] text-[var(--color-ochre-700)] border border-[var(--color-ochre-300)]">
                        ★ Best match
                      </span>
                    </div>
                  )}
                  <Link href={`/u?id=${o.workerId}`} target="_blank">
                    <Avatar name={o.workerName} photoURL={o.workerPhotoURL} size="md" />
                  </Link>
                  <div className="flex-1 min-w-[200px]">
                    <Link
                      href={`/u?id=${o.workerId}`}
                      target="_blank"
                      className="font-medium hover:underline decoration-[var(--color-ochre-500)] underline-offset-2"
                    >
                      {o.workerName}
                    </Link>
                    <div className="mt-1 flex items-center gap-2 flex-wrap text-sm">
                      <StarsRead value={o.workerRatingAvg} count={o.workerRatingCount} />
                      {typeof o.workerJobsCompleted === "number" && o.workerJobsCompleted > 0 && (
                        <span className="text-xs text-[var(--color-ink-muted)]">
                          · {o.workerJobsCompleted} completed job{o.workerJobsCompleted === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    {o.workerBadges && o.workerBadges.length > 0 && (
                      <div className="mt-2">
                        <ReputationBadges
                          badges={o.workerBadges
                            .map((id) => ALL_BADGES[id])
                            .filter(Boolean)}
                        />
                      </div>
                    )}
                    {o.message && (
                      <p className="mt-2 text-sm text-[var(--color-ink-soft)] italic">
                        &ldquo;{o.message}&rdquo;
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl text-[var(--color-ochre-600)]">
                      R {o.price}
                    </p>
                    <p className="text-xs text-[var(--color-ink-muted)]">
                      {o.price === job.suggestedPrice ? "At your price" : "Counter-offer"}
                    </p>
                  </div>
                  <div className="w-full flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => onReject(o)} disabled={busy}>
                      Reject
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => onAccept(o)} disabled={busy}>
                      Accept
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* ---------- LEGACY SINGLE-WORKER PATH ---------- */}
      {!crewMode && (job.status === "assigned" || job.status === "in_progress") && (
        <Notice tone={job.status === "in_progress" ? "sage" : "ochre"}>
          Assigned to{" "}
          {job.assignedWorkerId ? (
            <Link
              href={`/u?id=${job.assignedWorkerId}`}
              className="font-semibold underline decoration-[var(--color-ochre-500)] underline-offset-2"
            >
              {job.assignedWorkerName}
            </Link>
          ) : (
            <b>{job.assignedWorkerName}</b>
          )}{" "}
          at <b>R {job.agreedPrice}</b>.{" "}
          {job.status === "in_progress"
            ? "✓ They've started — the job is in progress."
            : job.enRouteAt
              ? "🚗 They're on their way."
              : "Waiting for them to start."}
        </Notice>
      )}

      {!crewMode && job.status === "confirmed" && job.assignedWorkerId && (
        <div className="mt-4 rounded-xl p-4 bg-[var(--color-cream-2)] border border-[var(--color-line)] flex items-center justify-between gap-3 flex-wrap">
          <span className="text-sm text-[var(--color-ink-soft)]">
            Happy with {job.assignedWorkerName}&apos;s work?
          </span>
          <Button
            href={`/post-a-job?rebook=${job.id}`}
            variant="primary"
            size="sm"
          >
            Rebook {job.assignedWorkerName?.split(" ")[0]}
          </Button>
        </div>
      )}

      {!crewMode && job.status === "completed" && (
        <div className="mt-6 rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
          <h2 className="font-display text-xl mb-2">Worker marked the job done</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mb-4">
            Please confirm — once confirmed, both of you can leave ratings.
          </p>
          <Button onClick={onConfirmDone} variant="primary" disabled={busy}>
            Confirm completion
          </Button>
        </div>
      )}

      {/* ---------- CREW (MULTI-WORKER) PATH ---------- */}
      {crewMode && crew.length > 0 && (
        <section className="mt-8">
          <div className="flex items-end justify-between flex-wrap gap-3 mb-3">
            <h2 className="font-display text-2xl">
              Crew · {filled}/{needed}
            </h2>
            <p className="text-sm text-[var(--color-ink-muted)]">
              Total agreed: <b className="text-[var(--color-ink)]">R {crew.reduce((s, w) => s + (w.agreedPrice ?? 0), 0)}</b>
            </p>
          </div>

          {remaining > 0 && (
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap rounded-xl p-4 bg-[var(--color-cream-2)] border border-[var(--color-line)] text-sm text-[var(--color-ink-soft)]">
              <span>
                <b className="text-[var(--color-ink)]">{remaining}</b> spot
                {remaining === 1 ? " is" : "s are"} still open. The job will
                stay open for new offers until the crew is full.
              </span>
              <Button size="sm" variant="outline" onClick={onCloseCrewGap} disabled={busy || filled === 0}>
                Run with {filled} instead
              </Button>
            </div>
          )}

          <ul className="space-y-3">
            {crew.map((w) => (
              <li
                key={w.uid}
                className="rounded-xl p-5 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft animate-slide-up"
              >
                <div className="flex items-start gap-4 flex-wrap">
                  <Link href={`/u?id=${w.uid}`} target="_blank">
                    <Avatar name={w.name} photoURL={w.photoURL} size="md" />
                  </Link>
                  <div className="flex-1 min-w-[180px]">
                    <Link
                      href={`/u?id=${w.uid}`}
                      target="_blank"
                      className="font-medium hover:underline decoration-[var(--color-ochre-500)] underline-offset-2"
                    >
                      {w.name}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
                      Joined {new Date(w.joinedAt).toLocaleString()}
                    </p>
                    <p className="mt-2 text-sm">
                      Status:{" "}
                      <b className="text-[var(--color-ink)]">
                        {w.status === "assigned"
                          ? (w.enRouteAt ? "🚗 On their way" : "Waiting to start")
                          : w.status === "in_progress" ? "✓ Started — in progress"
                          : w.status === "completed" ? "Marked done — please confirm"
                          : w.status === "confirmed" ? "Work confirmed"
                          : w.status}
                      </b>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl text-[var(--color-ochre-600)]">
                      R {w.agreedPrice}
                    </p>
                    <p className="text-xs text-[var(--color-ink-muted)]">
                      {job.paymentMethod === "eft" ? "EFT on completion" : "Cash on completion"}
                    </p>
                  </div>
                </div>

                {/* Per-worker actions */}
                <div className="mt-4 flex flex-wrap gap-2 justify-end">
                  {w.status === "completed" && (
                    <Button size="sm" variant="primary" onClick={() => onConfirmWorker(w)} disabled={busy}>
                      Confirm + pay
                    </Button>
                  )}
                  {(w.status === "assigned" || w.status === "in_progress") && (
                    <Button size="sm" variant="outline" onClick={() => onRemoveWorker(w)} disabled={busy}>
                      Remove from crew
                    </Button>
                  )}
                  {w.status === "confirmed" && (
                    <Button
                      href={`/post-a-job?rebook=${job.id}`}
                      variant="outline"
                      size="sm"
                    >
                      Rebook {w.name.split(" ")[0]}
                    </Button>
                  )}
                </div>

                {/* Payment handshake for this slot (employer side) */}
                {w.status === "confirmed" && (
                  <PaymentHandshakeCard
                    job={job}
                    asEmployer
                    worker={w}
                    setBusy={setBusy}
                    setError={setError}
                    busy={busy}
                  />
                )}

                {/* Per-worker rating UI for the employer, once confirmed */}
                {w.status === "confirmed" && (
                  <CrewWorkerRating
                    job={job}
                    worker={w}
                    asEmployer
                    setBusy={setBusy}
                    setError={setError}
                    busy={busy}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

/**
 * Per-worker rating widget used inside the crew panel and in the assigned
 * worker's own view of a crew job. Stores into assignedWorkers[i].employerRating
 * or .workerRating depending on which side is rating.
 */
function CrewWorkerRating({
  job,
  worker,
  asEmployer,
  setBusy,
  setError,
  busy,
}: {
  job: Job;
  worker: AssignedWorker;
  asEmployer: boolean;
  setBusy: (b: boolean) => void;
  setError: (s: string | null) => void;
  busy: boolean;
}) {
  const existing = asEmployer ? worker.employerRating : worker.workerRating;
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");

  if (existing) {
    return (
      <Notice tone="sage">
        You rated {asEmployer ? worker.name : "the employer"} {existing.stars}/5. Thanks.
      </Notice>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const trimmed = text.trim();
      // Employer rating a crew member must name them; a crew member rating the
      // employer is inferred server-side from the caller.
      await submitRating(
        job.id,
        stars,
        trimmed || undefined,
        asEmployer ? worker.uid : undefined,
        asEmployer ? "customer" : "worker",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save rating.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 rounded-xl p-4 bg-[var(--color-cream-2)] border border-[var(--color-line)] space-y-3"
    >
      <p className="text-sm font-medium text-[var(--color-ink)]">
        Rate {asEmployer ? worker.name : "the employer"}
      </p>
      <StarsInput value={stars} onChange={setStars} />
      <Textarea
        label="Add a short note (optional)"
        name={`rating-${worker.uid}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="What went well?"
      />
      <Button type="submit" variant="primary" size="sm" loading={busy} loadingText="Saving…">
        Submit rating
      </Button>
    </form>
  );
}

function WorkerLifecycle({
  job,
  myCrewEntry,
  myUid,
  onChange,
  setBusy,
  setError,
  busy,
}: {
  job: Job;
  /** When set, this is a crew job and the worker's slot drives the UI. */
  myCrewEntry?: AssignedWorker;
  /** The current viewer's auth uid — needed to call leaveJob. */
  myUid: string;
  onChange: () => Promise<void>;
  setBusy: (b: boolean) => void;
  setError: (s: string | null) => void;
  busy: boolean;
}) {
  const confirm = useConfirm();
  const crewMode = !!myCrewEntry;
  // For crew workers, use their slot status; otherwise fall back to the job-level status.
  const lifecycleStatus = myCrewEntry?.status ?? job.status;
  const myPrice = myCrewEntry?.agreedPrice ?? job.agreedPrice;
  const profileUidForLeave = crewMode ? myCrewEntry?.uid : myUid;

  const enRoute = crewMode ? !!myCrewEntry?.enRouteAt : !!job.enRouteAt;
  const alreadyVerified = crewMode ? !!myCrewEntry?.startVerifiedAt : !!job.startVerifiedAt;
  const needPin = !!job.requireStartPin && !alreadyVerified;
  const [pinMode, setPinMode] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const employerFirst = job.employerName?.split(" ")[0] ?? "the employer";

  const onEnRoute = async () => {
    setBusy(true);
    setError(null);
    try {
      await markEnRoute(job.id, crewMode ? myCrewEntry?.uid : undefined);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update.");
    } finally {
      setBusy(false);
    }
  };

  const onStart = async () => {
    // When a start code is required, route through PIN entry instead of starting
    // directly — the server flips the job to in_progress on a correct code.
    if (needPin) {
      setPinMode(true);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await markInProgress(job.id, crewMode ? myCrewEntry?.uid : undefined);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update.");
    } finally {
      setBusy(false);
    }
  };

  const onVerifyPin = async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyJobStartPin(job.id, pinValue.trim());
      setPinMode(false);
      setPinValue("");
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't verify the code.");
    } finally {
      setBusy(false);
    }
  };

  const onDone = async () => {
    const ok = await confirm({
      title: "Mark this job complete?",
      body: crewMode
        ? "Just for your portion — other crew members keep their own lifecycle. The employer will be asked to confirm your work, and then you can both leave a rating."
        : "The employer will be asked to confirm. Once they do, you'll both leave ratings.",
      tone: "success",
      confirmLabel: "Yes, it's done",
      cancelLabel: "Not yet",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await markCompletedByWorker(job.id, crewMode ? myCrewEntry?.uid : undefined);
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  const onLeave = async () => {
    const ok = await confirm({
      title: crewMode ? "Leave this crew?" : "Leave this job?",
      body: crewMode
        ? "Your spot in the crew opens up so the employer can find another worker. You can re-offer later if you change your mind, but it's a small ding to your reputation if you do this often."
        : "The job goes back to open and the employer can pick another worker. You can re-offer later if you change your mind, but it's a small ding to your reputation if you do this often.",
      tone: "danger",
      confirmLabel: crewMode ? "Yes, leave the crew" : "Yes, leave the job",
      cancelLabel: "Stay",
    });
    if (!ok) return;
    if (!profileUidForLeave) return;
    setBusy(true);
    setError(null);
    try {
      await leaveJob(job.id, profileUidForLeave);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not leave the job.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
      <h2 className="font-display text-xl mb-2">
        {crewMode ? "Your portion of this crew job" : "Your job"}
      </h2>
      <p className="text-sm text-[var(--color-ink-soft)] mb-4">
        Agreed price: <b>R {myPrice}</b>.{" "}
        {job.paymentMethod === "eft" ? "EFT" : "Cash"} on completion.
        {crewMode && (
          <>
            {" "}You&apos;re part of a {job.workersNeeded}-person crew — your
            status updates here are independent of the others.
          </>
        )}
      </p>
      {lifecycleStatus === "assigned" && (
        <div className="space-y-3">
          {pinMode ? (
            <div className="rounded-xl bg-[var(--color-cream-2)] border border-[var(--color-line)] p-4 space-y-3">
              <p className="text-sm font-medium text-[var(--color-ink)]">Enter the start code</p>
              <p className="text-xs text-[var(--color-ink-soft)]">
                Ask {employerFirst} for the 4-digit code and enter it to start the job.
              </p>
              <input
                aria-label="4-digit start code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                value={pinValue}
                onChange={(e) =>
                  setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="••••"
                className="w-full rounded-md bg-[var(--color-paper)] border border-[var(--color-line)] px-4 py-3 text-center text-2xl tracking-[0.4em] text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ochre-300)] focus:border-[var(--color-ochre-500)]"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={onVerifyPin}
                  variant="primary"
                  disabled={busy || pinValue.length !== 4}
                  loading={busy}
                  loadingText="Checking…"
                >
                  Verify &amp; start
                </Button>
                <Button
                  onClick={() => {
                    setPinMode(false);
                    setPinValue("");
                    setError(null);
                  }}
                  variant="ghost"
                  disabled={busy}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 items-center">
                <Button
                  onClick={onEnRoute}
                  variant={enRoute ? "outline" : "primary"}
                  disabled={busy || enRoute}
                >
                  {enRoute ? "✓ On my way" : "I'm on my way"}
                </Button>
                <Button onClick={onStart} variant={enRoute ? "primary" : "secondary"} disabled={busy}>
                  {needPin ? "Enter start code to begin" : "I've started the job"}
                </Button>
                <Button onClick={onLeave} variant="ghost" disabled={busy}>
                  {crewMode ? "Leave the crew" : "Leave the job"}
                </Button>
              </div>
              <p className="text-xs text-[var(--color-ink-muted)]">
                {needPin
                  ? `When you arrive, ask ${employerFirst} for the 4-digit start code to begin.`
                  : enRoute
                    ? "The employer can see you're on your way. Tap “I've started the job” once you're there and working."
                    : "Tap “I'm on my way” to let the employer know you're travelling, then “I've started the job” when you begin."}
              </p>
            </>
          )}
          {/* Auto-arm: the moment they're heading out, nudge a one-tap safety
              check-in to a saved trusted contact. */}
          {enRoute && !pinMode && (
            <TrustedContactArm
              job={job}
              role="worker"
              myName={crewMode ? myCrewEntry?.name : job.assignedWorkerName}
            />
          )}
        </div>
      )}
      {lifecycleStatus === "in_progress" && (
        <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
          Already started? You can&apos;t leave without raising a dispute now —
          use the dispute button at the bottom of the page if something&apos;s
          gone wrong.
        </p>
      )}
      {lifecycleStatus === "in_progress" && (
        <>
          <CompletionPhotoUpload job={job} />
          <div className="mt-4">
            <Button onClick={onDone} variant="secondary" disabled={busy}>
              Mark {crewMode ? "my portion" : "job"} done
            </Button>
          </div>
        </>
      )}
      {lifecycleStatus === "completed" && (
        <Notice>Marked done. Waiting for the employer to confirm.</Notice>
      )}
      {lifecycleStatus === "confirmed" && crewMode && (
        <Notice tone="sage">
          Confirmed + paid. Leave a rating for the employer below.
        </Notice>
      )}
    </section>
  );
}

function CompletionPhotoUpload({ job }: { job: Job }) {
  return (
    <div className="mt-4 rounded-xl bg-[var(--color-cream-2)] border border-[var(--color-line)] p-4">
      <p className="text-sm font-medium text-[var(--color-ink)]">
        Add &ldquo;after&rdquo; photos — proof of work (recommended)
      </p>
      <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
        Photos are taken with your camera and automatically time-stamped, so they
        count as real, verifiable proof of the work you did — not a picture from
        your gallery. A clear finished-work photo makes employers much more
        comfortable confirming + leaving a great rating, and it builds your public
        portfolio.
      </p>
      {job.completionPhotoURLs && job.completionPhotoURLs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {job.completionPhotoURLs.map((url, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={url}
              src={url}
              alt={`Done ${i + 1}`}
              className="w-16 h-16 rounded-lg object-cover border border-[var(--color-line)]"
            />
          ))}
        </div>
      )}
      <div className="mt-3">
        <PhotoUploader
          kind="job"
          scopeId={job.id}
          accept="image/*"
          capture="environment"
          stamp
          label="📷 Take a photo"
          hint="Opens your camera — the photo is time-stamped as proof of work."
          onUploaded={async (url) => {
            const existing = job.completionPhotoURLs ?? [];
            await updateJob(job.id, {
              completionPhotoURLs: [...existing, url],
            });
          }}
        />
      </div>
    </div>
  );
}

function RatingSection({
  job,
  asEmployer,
  onRated,
  setBusy,
  setError,
  busy,
}: {
  job: Job;
  asEmployer: boolean;
  onRated: () => Promise<void>;
  setBusy: (b: boolean) => void;
  setError: (s: string | null) => void;
  busy: boolean;
}) {
  const myRating = asEmployer ? job.employerRating : job.workerRating;
  const [stars, setStars] = useState(5);
  const [text, setText] = useState("");

  if (myRating) {
    return (
      <Notice tone="sage">
        You rated this {myRating.stars}/5. Thanks for the feedback.
      </Notice>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // The submitRating callable infers direction (employer→worker or
      // worker→employer) from the caller's auth token, checks the job is
      // confirmed, and writes the rating + reputation aggregate server-side.
      await submitRating(
        job.id,
        stars,
        text.trim() || undefined,
        undefined,
        asEmployer ? "customer" : "worker",
      );
      await onRated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save rating.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft space-y-4"
    >
      <h2 className="font-display text-xl">
        Rate {asEmployer ? "the worker" : "the employer"}
      </h2>
      <StarsInput value={stars} onChange={setStars} />
      <Textarea
        label="Add a short note (optional)"
        name="ratingText"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="What went well? What could improve?"
      />
      <Button type="submit" variant="primary" loading={busy} loadingText="Saving…">
        Submit rating
      </Button>
    </form>
  );
}
