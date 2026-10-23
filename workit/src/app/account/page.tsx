"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import JobTabs from "@/components/JobTabs";
import AccountGate from "@/components/AccountGate";
import { JobCardSkeletonGrid, PageSkeleton } from "@/components/Skeleton";
import { StarsRead } from "@/components/Stars";
import Avatar from "@/components/Avatar";
import ReputationBadges from "@/components/ReputationBadges";
import { computeBadges } from "@/lib/types";
import WorkerLevelBadge from "@/components/WorkerLevelBadge";
import ReferralCard from "@/components/ReferralCard";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { getJob, subscribeMyAssignedJobs, subscribeMyJobs } from "@/lib/jobs";
import { subscribeSavedJobIds } from "@/lib/saved";
import { isEmployerSide, type BusinessLead, type Job, type UserProfile, type UserRole } from "@/lib/types";
import { doc, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { subscribeBusinessLeads } from "@/lib/businessLeads";
import { profileCompletionPct } from "@/lib/profile-completion";
import AnimatedNumber from "@/components/AnimatedNumber";
import AvailableNowCard from "@/components/AvailableNowCard";
import WhatsAppJobAlertsCard from "@/components/WhatsAppJobAlertsCard";
import SkillNudgeBanner from "@/components/SkillNudgeBanner";
import WorkRecordCard from "@/components/WorkRecordCard";
import CompletionRing from "@/components/CompletionRing";
import OnboardingCard from "@/components/OnboardingCard";
import VerificationProgress from "@/components/VerificationProgress";
import AddPasswordPrompt from "@/components/AddPasswordPrompt";
import VerifyPhonePrompt from "@/components/VerifyPhonePrompt";
import VerifyIdPrompt from "@/components/VerifyIdPrompt";
import PushPermissionPrompt from "@/components/PushPermissionPrompt";

export default function AccountPage() {
  return (
    <AccountGate>
      <AccountInner />
    </AccountGate>
  );
}

function AccountInner() {
  const router = useRouter();
  const { user, profile, loading, signOut, configured } = useAuth();
  const notif = useNotifications();
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [assigned, setAssigned] = useState<Job[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (!loading && configured && !user) router.replace("/signin");
  }, [loading, user, router, configured]);

  useEffect(() => {
    if (!profile) return;
    setDataLoading(true);
    const unsubs: Array<() => void> = [];
    if (isEmployerSide(profile.role)) {
      unsubs.push(
        subscribeMyJobs(profile.uid, (list) => {
          setMyJobs(list);
          setDataLoading(false);
        }),
      );
    }
    if (profile.role === "worker") {
      unsubs.push(
        subscribeMyAssignedJobs(profile.uid, (list) => {
          setAssigned(list);
          setDataLoading(false);
        }),
      );
    }
    if (unsubs.length === 0) setDataLoading(false);
    return () => unsubs.forEach((u) => u());
  }, [profile]);

  // Saved jobs (workers) — subscribe to IDs, then fetch each job doc.
  useEffect(() => {
    if (!profile || profile.role !== "worker") return;
    const unsub = subscribeSavedJobIds(profile.uid, async (ids) => {
      const fetched = await Promise.all(
        Array.from(ids).map(async (id) => {
          try {
            return await getJob(id);
          } catch {
            return null;
          }
        }),
      );
      setSavedJobs(fetched.filter((j): j is Job => !!j));
    });
    return () => unsub();
  }, [profile]);

  if (!configured) {
    return (
      <Frame>
        <p>Firebase isn&apos;t configured yet — see <Link href="/setup" className="underline">/setup</Link>.</p>
      </Frame>
    );
  }
  if (loading || !user) {
    return (
      <Frame>
        <PageSkeleton />
      </Frame>
    );
  }

  const role = profile?.role ?? "employer";
  const verification = profile?.verificationStatus ?? "none";
  const open = myJobs.filter((j) => j.status === "open");
  const active = myJobs.filter((j) =>
    ["assigned", "in_progress", "completed", "disputed"].includes(j.status),
  );
  const done = myJobs.filter((j) => j.status === "confirmed");
  const cancelled = myJobs.filter((j) => j.status === "cancelled");

  // Worker earnings (lifetime, from confirmed assigned jobs)
  const completedWorkerJobs = assigned.filter((j) => j.status === "confirmed");
  const totalEarned = completedWorkerJobs.reduce(
    (sum, j) => sum + (j.agreedPrice ?? 0),
    0,
  );
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);
  const earnedThisMonth = completedWorkerJobs
    .filter((j) => (j.completedAt ?? j.updatedAt ?? 0) >= thisMonthStart.getTime())
    .reduce((sum, j) => sum + (j.agreedPrice ?? 0), 0);

  const completionPct = profile ? profileCompletionPct(profile) : 0;

  const wActive = assigned.filter((j) =>
    ["assigned", "in_progress", "completed"].includes(j.status),
  );
  const wDone = assigned.filter((j) => j.status === "confirmed");

  return (
    <Frame>
      {/* Phone-signed-up users get prompted to add an email + password so
          they can skip the SMS step next time. Renders nothing for users
          who already have a password credential or who dismissed it. */}
      <div className="mb-6 space-y-3">
        <AddPasswordPrompt />
        <VerifyPhonePrompt />
        <VerifyIdPrompt />
        <PushPermissionPrompt />
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div className="flex items-start gap-4">
          <Avatar
            name={profile?.displayName}
            photoURL={profile?.photoURL}
            size="xl"
          />
          <div>
            <Badge tone={role === "worker" ? "sage" : role === "admin" ? "ink" : "ochre"}>
              {role === "worker"
                ? "Worker account"
                : role === "admin"
                  ? "Admin"
                  : role === "business"
                    ? "Business account"
                    : "Employer account"}
            </Badge>
            <h1 className="mt-3 font-display text-3xl sm:text-4xl tracking-tight">
              Sawubona, {profile?.displayName || user.email}.
            </h1>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{user.email}</p>
            <div className="mt-2">
              <StarsRead value={profile?.ratingAvg} count={profile?.ratingCount} />
            </div>
            {profile && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <ReputationBadges badges={computeBadges(profile)} />
                {profile.role === "worker" && <WorkerLevelBadge profile={profile} />}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {profile && (
            <Link
              href="/profile"
              className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full hover:bg-[var(--color-cream-2)]"
              title={`Profile is ${completionPct}% complete`}
            >
              <CompletionRing pct={completionPct} size={42} />
              <span className="text-xs text-[var(--color-ink-muted)] leading-tight">
                Profile<br />complete
              </span>
            </Link>
          )}
          <Button href="/profile" variant="outline" size="sm">Edit profile</Button>
          <Button href="/account/security" variant="outline" size="sm">Security</Button>
          {role === "admin" && (
            <Button href="/admin" variant="outline" size="sm">Admin queue</Button>
          )}
          <Button variant="outline" size="sm" onClick={() => signOut()}>Sign out</Button>
        </div>
      </div>

      <OnboardingCard role={role as UserRole} />
      {role === "employer" && <UpgradeToBusinessCard />}
      {role === "business" && profile && <BusinessProCard profile={profile} />}
      {role === "business" && <BusinessLeadsCard />}

      {/* Identity verification — REQUIRED for all roles since 2026-07-08.
          Earns the ✓ ID-verified badge workers see before they accept a job. */}
      {(role === "employer" || role === "business") && (
        <section className="mb-6 rounded-2xl p-5 sm:p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h2 className="font-display text-xl text-[var(--color-ink)]">
                {verification === "approved" ? "✓ Identity verified" : "Verify your identity"}
                {verification !== "approved" && (
                  <span className="ml-2 text-xs font-normal text-[var(--color-brick)]">required</span>
                )}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-ink-soft)] max-w-md">
                {verification === "approved"
                  ? "Workers see a ✓ ID-verified badge on your jobs — it helps them feel safe accepting."
                  : verification === "pending"
                    ? "Your documents are in for review. We'll update your status soon."
                    : verification === "rejected"
                      ? "Your last submission needs another look — please resubmit."
                      : verification === "changes_requested"
                        ? "One quick fix needed — see the note below, then resubmit."
                        : "Workers are ID-verified, and it works both ways — add your ID so workers know who's hiring them (a short selfie is optional and speeds up approval). Required to unlock your account."}
              </p>
              {(verification === "rejected" || verification === "changes_requested") &&
                profile?.verification?.reviewerNote && (
                  <p className="mt-2 text-xs text-[var(--color-brick)]">
                    Note: {profile.verification.reviewerNote}
                  </p>
                )}
            </div>
            {verification !== "approved" && verification !== "pending" && (
              <Button href="/verification" variant="primary" size="sm">
                {verification === "rejected" || verification === "changes_requested"
                  ? "Fix and resubmit"
                  : "Verify now"}
              </Button>
            )}
          </div>
        </section>
      )}
      <EmailVerifyBanner />
      {profile && <ReferralCard profile={profile} />}
      <NotificationsCard notif={notif} />
      <NotificationPrefsCard notif={notif} role={role} />

      {/* One-time nudge: skills power the employer directory search (2026-07-06);
          existing workers all have an empty list until they pick some. */}
      {role === "worker" && profile && <SkillNudgeBanner profile={profile} />}

      {/* Worker "Available now" toggle — appears above earnings */}
      {role === "worker" && profile && <AvailableNowCard profile={profile} />}

      {/* Worker WhatsApp Job Channel opt-in (low-data job alerts) */}
      {role === "worker" && profile && <WhatsAppJobAlertsCard profile={profile} />}

      {/* Worker earnings — quick at-a-glance card */}
      {role === "worker" && completedWorkerJobs.length > 0 && (
        <section className="mb-6 grid sm:grid-cols-3 gap-3">
          <EarningsTile label="Total earned" value={totalEarned} prefix="R " tone="ochre" />
          <EarningsTile label="This month" value={earnedThisMonth} prefix="R " tone="sage" />
          <EarningsTile label="Jobs completed" value={completedWorkerJobs.length} tone="ink" />
        </section>
      )}

      {/* Shareable proof-of-work certificate (unlocks after the first job) */}
      {role === "worker" && profile && (
        <div className="mb-6">
          <WorkRecordCard profile={profile} />
        </div>
      )}

      {role === "worker" && profile && (
        <div className="mb-6">
          <VerificationProgress profile={profile} />
        </div>
      )}

      {/* Employer WhatsApp opt-in (review + accept/decline offers over WhatsApp) */}
      {isEmployerSide(role) && profile && (
        <WhatsAppJobAlertsCard profile={profile} variant="employer" />
      )}

      {isEmployerSide(role) && (
        <section className="mb-8">
          <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
            <h2 className="font-display text-2xl">Your jobs</h2>
            <div className="flex gap-2">
              <Button href="/workers" variant="outline" size="sm">Browse workers</Button>
              <Button href="/post-a-job" variant="primary" size="sm">+ Post a job</Button>
            </div>
          </div>

          {dataLoading ? (
            <JobCardSkeletonGrid count={3} />
          ) : (
            <JobTabs
              tabs={[
                {
                  id: "current",
                  label: "Current",
                  jobs: [...open, ...active],
                  empty: "Nothing in progress yet",
                  emptyKind: "no-jobs",
                  emptyAction: (
                    <Button href="/post-a-job" variant="primary" size="md">+ Post a job</Button>
                  ),
                },
                {
                  id: "completed",
                  label: "Completed",
                  jobs: done,
                  empty: "No completed jobs yet",
                  emptyKind: "approved",
                },
                { id: "cancelled", label: "Cancelled", jobs: cancelled, empty: "" },
              ]}
            />
          )}
        </section>
      )}

      {role === "worker" && (
        <section className="mb-8">
          <h2 className="font-display text-2xl mb-4">Your work</h2>
          {dataLoading ? (
            <JobCardSkeletonGrid count={3} />
          ) : (
            <JobTabs
              tabs={[
                {
                  id: "current",
                  label: "Current",
                  jobs: wActive,
                  empty: "No work on right now",
                  emptyKind: "no-jobs",
                  emptyAction: (
                    <Button href="/find-work" variant="primary" size="md">Browse open jobs</Button>
                  ),
                },
                {
                  id: "completed",
                  label: "Completed",
                  jobs: wDone,
                  empty: "Your finished jobs land here",
                  emptyKind: "approved",
                },
                {
                  id: "saved",
                  label: "Saved",
                  jobs: savedJobs,
                  empty: "Nothing saved yet",
                  emptyKind: "no-saved",
                  emptyAction: (
                    <Button href="/find-work" variant="outline" size="md">Browse jobs</Button>
                  ),
                },
              ]}
            />
          )}
        </section>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-14 max-w-4xl">{children}</Container>
      </main>
      <Footer />
    </>
  );
}

function BusinessLeadsCard() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<BusinessLead[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeBusinessLeads(user.uid, setLeads);
    return () => unsub();
  }, [user]);

  return (
    <section className="mb-8">
      <h2 className="font-display text-2xl mb-3">
        Interested workers{leads.length > 0 ? ` (${leads.length})` : ""}
      </h2>
      {leads.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] p-6 text-sm text-[var(--color-ink-muted)]">
          No interest yet. Workers who find you in the directory or on your jobs can tap
          &quot;I&apos;m interested&quot; — they&apos;ll show up here for you to view and invite.
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper)] divide-y divide-[var(--color-line)]">
          {leads.map((l) => (
            <div key={l.id} className="p-4 flex items-start gap-3">
              <Avatar name={l.workerName} photoURL={l.workerPhotoURL} size="sm" />
              <div className="flex-1 min-w-0">
                <Link href={`/u?id=${l.workerUid}`} className="font-medium hover:underline">
                  {l.workerName}
                </Link>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  {new Date(l.createdAt).toLocaleString()}
                </p>
                {l.message && (
                  <p className="mt-1 text-sm text-[var(--color-ink-soft)] whitespace-pre-wrap">{l.message}</p>
                )}
              </div>
              <Link
                href={`/u?id=${l.workerUid}`}
                className="text-xs underline whitespace-nowrap text-[var(--color-ink)]"
              >
                View profile →
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BusinessProCard({ profile }: { profile: UserProfile }) {
  const { user, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const pro = !!profile.businessPro;

  const toggle = async (on: boolean) => {
    if (!user) return;
    setBusy(true);
    try {
      await updateDoc(
        doc(getDb(), "users", user.uid),
        on ? { businessPro: true, businessProSince: Date.now() } : { businessPro: false },
      );
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  };

  if (pro) {
    return (
      <section className="mb-8 rounded-2xl p-6 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)]">
        <h2 className="font-display text-xl">✦ Workit Pro — active</h2>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)] leading-relaxed max-w-lg">
          Your business shows a <b>Pro</b> badge and ranks first in the businesses
          directory. <b className="text-[var(--color-ink)]">Free during launch.</b>
        </p>
        <div className="mt-4">
          <Button variant="ghost" size="sm" onClick={() => toggle(false)} loading={busy} loadingText="Updating…">
            Turn off Pro
          </Button>
        </div>
      </section>
    );
  }
  return (
    <section className="mb-8 rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
      <h2 className="font-display text-xl">✦ Upgrade to Workit Pro</h2>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)] leading-relaxed max-w-lg">
        Stand out to workers: a <b>Pro</b> badge on your profile and jobs, plus
        priority placement in the businesses directory.{" "}
        <b className="text-[var(--color-ink)]">Free during launch</b> — we&apos;ll tell
        you well before it ever costs anything.
      </p>
      <div className="mt-4">
        <Button variant="primary" size="sm" onClick={() => toggle(true)} loading={busy} loadingText="Activating…">
          Get Pro — free
        </Button>
      </div>
    </section>
  );
}

function UpgradeToBusinessCard() {
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const upgrade = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await updateDoc(doc(getDb(), "users", user.uid), { role: "business" });
      await refreshProfile();
      router.push("/business/edit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-8 rounded-2xl p-6 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)]">
      <h2 className="font-display text-xl">Run a business?</h2>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)] leading-relaxed">
        Upgrade to a <b>business account</b> to get a public profile, a directory listing, and the
        Verified business badge — so workers know who they&apos;re working for. You keep all your
        jobs and history.
      </p>
      <div className="mt-4 flex items-center gap-2">
        {confirming ? (
          <>
            <Button variant="primary" size="sm" onClick={upgrade} loading={busy} loadingText="Upgrading…">
              Confirm upgrade
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
            Upgrade to business account
          </Button>
        )}
      </div>
    </section>
  );
}

function NotificationPrefsCard({
  notif,
  role,
}: {
  notif: ReturnType<typeof useNotifications>;
  role: UserRole;
}) {
  if (notif.permission === "unsupported") return null;
  if (!notif.enabled) return null;

  const isWorker = role === "worker";
  const isEmployer = isEmployerSide(role);

  const items: Array<{ key: keyof typeof notif.prefs; label: string; show: boolean }> = [
    { key: "newOffer", label: "New offer on my job", show: isEmployer },
    { key: "workerStarted", label: "Worker has started", show: isEmployer },
    { key: "jobDone", label: "Worker marked job done", show: isEmployer },
    { key: "offerAccepted", label: "My offer was accepted", show: isWorker },
    { key: "jobConfirmed", label: "Job confirmed (rate now)", show: isWorker },
    { key: "newMatchingJob", label: "New job in my categories", show: isWorker },
  ];
  const visible = items.filter((i) => i.show);
  if (visible.length === 0) return null;

  return (
    <section className="rounded-2xl p-5 mb-6 bg-[var(--color-paper)] border border-[var(--color-line)]">
      <p className="text-sm font-medium text-[var(--color-ink)] mb-1">
        Which notifications do you want?
      </p>
      <p className="text-xs text-[var(--color-ink-muted)] mb-3">
        Mute things you find noisy — your choice is remembered on this device.
      </p>
      <div className="space-y-2">
        {visible.map((i) => (
          <label
            key={i.key}
            className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-[var(--color-cream-2)] cursor-pointer"
          >
            <span className="text-sm text-[var(--color-ink)]">{i.label}</span>
            <input
              type="checkbox"
              checked={notif.prefs[i.key]}
              onChange={(e) => notif.setPref(i.key, e.target.checked)}
              className="w-5 h-5 accent-[var(--color-ochre-500)]"
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function EarningsTile({
  label,
  value,
  prefix,
  tone,
}: {
  label: string;
  value: number;
  prefix?: string;
  tone: "ochre" | "sage" | "ink";
}) {
  const toneClasses: Record<typeof tone, string> = {
    ochre: "bg-[var(--color-ochre-50)] border-[var(--color-ochre-300)]",
    sage: "bg-[var(--color-sage-100)]/40 border-[var(--color-sage-400)]/40",
    ink: "bg-[var(--color-cream-2)] border-[var(--color-line)]",
  } as Record<typeof tone, string>;
  return (
    <div className={`rounded-2xl p-5 border ${toneClasses[tone]}`}>
      <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)]">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl text-[var(--color-ink)] tabular-nums">
        {prefix}<AnimatedNumber value={value} />
      </p>
    </div>
  );
}

function EmailVerifyBanner() {
  const { user, resendEmailVerification } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Only show for users whose Firebase email isn't verified yet.
  if (!user || user.emailVerified) return null;

  const onResend = async () => {
    setSending(true);
    try {
      await resendEmailVerification();
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl p-5 mb-6 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p className="font-medium text-[var(--color-ink)]">
          Verify your email address
        </p>
        <p className="text-sm text-[var(--color-ink-soft)]">
          {sent
            ? "Sent ✓ Check your inbox and spam folder."
            : `We sent a verification link to ${user.email}. Click it to confirm this is really you.`}
        </p>
      </div>
      {!sent && (
        <Button size="sm" variant="outline" onClick={onResend} loading={sending} loadingText="Sending…">
          Resend email
        </Button>
      )}
    </div>
  );
}

function NotificationsCard({
  notif,
}: {
  notif: ReturnType<typeof useNotifications>;
}) {
  if (notif.permission === "unsupported") return null;
  const isGranted = notif.permission === "granted";
  const isDenied = notif.permission === "denied";

  return (
    <section className="rounded-2xl p-5 mb-6 bg-[var(--color-cream-2)] border border-[var(--color-line)] flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p className="font-medium text-[var(--color-ink)]">Live notifications</p>
        <p className="text-sm text-[var(--color-ink-soft)]">
          {isDenied
            ? "Blocked in your browser settings. Enable site notifications to receive alerts."
            : isGranted
              ? notif.enabled
                ? "On — you'll be alerted when something happens on your jobs."
                : "Browser permission granted but currently muted."
              : "Get a ping when a worker responds or your offer is accepted."}
        </p>
      </div>
      <div className="flex gap-2">
        {!isGranted && !isDenied && (
          <Button size="sm" variant="primary" onClick={() => notif.request()}>
            Enable notifications
          </Button>
        )}
        {isGranted && (
          <Button size="sm" variant="outline" onClick={() => notif.toggle()}>
            {notif.enabled ? "Mute" : "Unmute"}
          </Button>
        )}
      </div>
    </section>
  );
}


