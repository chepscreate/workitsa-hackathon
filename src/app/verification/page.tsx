"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import PageHero from "@/components/PageHero";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import { useAuth } from "@/contexts/AuthContext";
import { getDb, getFunctionsInstance } from "@/lib/firebase";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { CONSENT_VERSION } from "@/lib/popia";
import { track } from "@/lib/analytics";
import { useTranslation } from "@/contexts/LocaleContext";
import { ageFromDob } from "@/lib/types";
import { checkSaId, parseSaId, idCheckVerdict } from "@/lib/saId";
import PhotoUploader from "@/components/PhotoUploader";
import CategorySkillsPicker from "@/components/CategorySkillsPicker";
import LocationPicker from "@/components/LocationPicker";
import { approxCoord } from "@/lib/types";

function VerificationInner() {
  const router = useRouter();
  const search = useSearchParams();
  const welcome = search.get("welcome") === "1";
  const { user, profile, loading, refreshProfile } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (profile?.verificationStatus === "approved" && welcome) {
      router.replace("/");
    }
  }, [profile, welcome, router]);

  const [idNumber, setIdNumber] = useState("");
  const [idPhotoURL, setIdPhotoURL] = useState<string>("");
  const [selfieVideoURL, setSelfieVideoURL] = useState<string>("");
  const [addressLine, setAddressLine] = useState("");
  const [addressProofURL, setAddressProofURL] = useState<string>("");
  const [skillsSummary, setSkillsSummary] = useState("");
  const [skillProofURLs, setSkillProofURLs] = useState<string[]>([]);
  const [policeClearanceURL, setPoliceClearanceURL] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  // Home base (GPS) — folded in from the old profile step so onboarding is one
  // page. Optional: powers "jobs near you" distance sorting but doesn't block.
  const [home, setHome] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // The doc states above hold the STORED value — a Storage path for new uploads
  // (security: no forever-token URLs persisted) or a legacy https URL. Previews
  // hold a displayable URL per field, resolved via getVerificationPayload.
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const previewFor = (field: string, stored: string): string | undefined =>
    previews[field] ?? (stored.startsWith("http") ? stored : undefined);

  // Best-effort persist of an individual uploaded file as soon as it changes,
  // so a worker who navigates away and comes back keeps their uploads. This
  // does NOT stamp submittedAt: a partial upload must NOT appear in the admin
  // "submitted" queue — the account only counts as submitted once the worker
  // completes the form and hits Submit (which stamps submittedAt). Fixes the
  // "abandoned one-file uploads clog the review queue" problem (2026-07-12).
  const persistVerificationField = async (field: string, value: unknown) => {
    if (!user) return;
    try {
      await setDoc(
        doc(getDb(), "users", user.uid, "private", "profile"),
        { verification: { [field]: value } },
        { merge: true },
      );
    } catch {
      /* silent — final Submit will catch it */
    }
  };

  useEffect(() => {
    if (profile?.verification) {
      setIdNumber(profile.verification.idNumber ?? "");
      setIdPhotoURL(profile.verification.idPhotoURL ?? "");
      setSelfieVideoURL(profile.verification.selfieVideoURL ?? "");
      setAddressLine(profile.verification.addressLine ?? "");
      setAddressProofURL(profile.verification.addressProofURL ?? "");
      setSkillsSummary(profile.verification.skillsSummary ?? "");
      setSkillProofURLs(profile.verification.skillProofURLs ?? []);
      setPoliceClearanceURL(profile.verification.policeClearanceURL ?? "");
      // If they've already consented before (e.g. a re-submission), keep it ticked.
      if (profile.verification.consentAt) setConsent(true);

      // Any stored value that's a path (not a legacy URL) needs a short-lived
      // signed URL for its preview — resolve them all in one callable hit.
      const v = profile.verification;
      const hasPath = [v.idPhotoURL, v.selfieVideoURL, v.addressProofURL, v.policeClearanceURL]
        .some((x) => x && !x.startsWith("http"));
      if (hasPath) {
        const fn = httpsCallable<
          { uid?: string },
          { verification: Record<string, string | string[] | null> }
        >(getFunctionsInstance(), "getVerificationPayload");
        fn({})
          .then((res) => {
            const r = res.data?.verification ?? {};
            const next: Record<string, string> = {};
            for (const f of ["idPhotoURL", "selfieVideoURL", "addressProofURL", "policeClearanceURL"]) {
              if (typeof r[f] === "string") next[f] = r[f] as string;
            }
            setPreviews((p) => ({ ...next, ...p }));
          })
          .catch(() => {});
      }
    }
    if (profile?.categories) setCategories(profile.categories);
    if (profile?.skills) setSkills(profile.skills);
    if (typeof profile?.homeLat === "number" && typeof profile?.homeLng === "number") {
      setHome({ lat: profile.homeLat, lng: profile.homeLng });
    }
  }, [profile]);

  if (loading) {
    return <p className="text-[var(--color-ink-muted)]">Loading…</p>;
  }

  // Guests get the explainer; employers/businesses get the (optional) identity
  // form; workers get the full credential form below.
  if (!user || !profile) {
    return <VerificationOverview signedIn={!!user} />;
  }
  if (profile.role !== "worker") {
    return <EmployerVerificationForm />;
  }

  const status = profile.verificationStatus ?? "none";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError(t("ver.err.consent"));
      return;
    }
    // Automated SA ID check (Layer 1 KYC). Block structurally-invalid numbers
    // (failed Luhn = almost always a typo); DOB/gender mismatches are stored as
    // a warning for the admin rather than blocking.
    const idCheck = checkSaId(idNumber, {
      dob: profile.dateOfBirth,
      gender: profile.gender,
    });
    if (!idCheck.valid) {
      setError(`${t("ver.err.idInvalid")} ${idCheck.flags[0] ?? ""}`.trim());
      return;
    }
    // Hard 18+ gate on the ID itself — the number encodes the birth date, so
    // an under-18 ID is blocked regardless of the DOB typed at signup.
    const ageOnId = ageFromDob(idCheck.dob);
    if (ageOnId !== undefined && ageOnId < 18) {
      setError(t("ver.err.under18"));
      return;
    }
    // ID photo is COMPULSORY — the core of identity verification. The selfie
    // video is RECOMMENDED but no longer blocks submission (founder decision
    // 2026-07-12: it was too much friction on low-end phones; the admin can
    // still "Request changes" to ask for one when an ID looks doubtful).
    if (!idPhotoURL) {
      setError(t("ver.err.idPhoto"));
      return;
    }
    // Address + skills are compulsory too (founder decision 2026-07-10):
    // a worker can't be verified without proof of where they live, and can't
    // be found by employers without declaring what they do.
    if (!addressLine.trim()) {
      setError(t("ver.err.address"));
      return;
    }
    if (!addressProofURL) {
      setError(t("ver.err.addrProof"));
      return;
    }
    if (!skillsSummary.trim()) {
      setError(t("ver.err.skills"));
      return;
    }
    if (categories.length === 0) {
      setError("Please pick at least one work category — it's how employers find you.");
      return;
    }
    if (skills.length === 0) {
      setError("Please pick at least one specific skill under your category (e.g. Hair, Plumbing) — it's required.");
      return;
    }
    setSubmitting(true);
    try {
      // SENSITIVE payload (ID number + document URLs + address + skills) goes to
      // the PRIVATE subcollection — owner + admin only — never the world-readable
      // user doc. Only non-sensitive metadata (timestamps + consent) stays on the
      // public doc, where `onUserVerificationSubmitted` watches submittedAt and
      // flips verificationStatus server-side, and the admin queue can query it.
      await setDoc(
        doc(getDb(), "users", user.uid, "private", "profile"),
        {
          verification: {
            idNumber,
            idPhotoURL: idPhotoURL || null,
            selfieVideoURL: selfieVideoURL || null,
            addressLine,
            addressProofURL: addressProofURL || null,
            skillsSummary,
            skillProofURLs,
            policeClearanceURL: policeClearanceURL || null,
            // Full check (contains the resolved DOB) stays in the private doc.
            idCheck,
          },
          // Exact home coords are PRIVATE (owner + admin) — public doc gets the
          // ~1km rounded approx below.
          ...(home
            ? { homeLat: home.lat, homeLng: home.lng, homeAccuracy: home.accuracy ?? null, homePinnedAt: Date.now() }
            : {}),
        },
        { merge: true },
      );
      await updateDoc(doc(getDb(), "users", user.uid), {
        categories,
        skills,
        // Onboarding is one step now — verification submit also marks the
        // profile complete so nothing re-routes them back to a profile step.
        ...(profile.profileCompletedAt ? {} : { profileCompletedAt: Date.now() }),
        ...(home ? { approxLat: approxCoord(home.lat), approxLng: approxCoord(home.lng) } : {}),
        "verification.submittedAt": Date.now(),
        "verification.consentAt": Date.now(),
        "verification.consentVersion": CONSENT_VERSION,
        // Coarse verdict only (no PII) on the public doc → at-a-glance admin badge.
        "verification.idCheckVerdict": idCheckVerdict(idCheck),
      });
      if (profile.role === "worker") track("worker_verification_submitted");
      setDone(true);
      // Refresh so AccountGate sees the new verification.submittedAt
      await refreshProfile();
      if (welcome) {
        router.push("/account");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ver.err.couldNotSubmit"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {welcome && (
        <div className="mb-6 rounded-xl p-5 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] text-sm text-[var(--color-ink-soft)] animate-slide-up">
          <p className="font-medium text-[var(--color-ink)]">
            {t("ver.welcome.title")}
          </p>
          <p className="mt-1">{t("ver.welcome.body")}</p>
        </div>
      )}
      <PageHero
        eyebrow={t("ver.hero.eyebrow")}
        eyebrowTone="sage"
        title={welcome ? t("ver.hero.titleWelcome") : t("ver.hero.title")}
        intro={t("ver.hero.intro")}
      />

      {status === "changes_requested" ? (
        <div className="mt-6 rounded-xl p-5 bg-[var(--color-ochre-50)] border-2 border-[var(--color-ochre-500)] text-sm animate-slide-up">
          <p className="font-medium text-[var(--color-ink)] flex items-center gap-2">
            <span aria-hidden>✋</span> {t("ver.changes.title")}
          </p>
          {profile.verification?.reviewerNote && (
            <p className="mt-2 text-[var(--color-ink)] font-medium border-l-2 border-[var(--color-ochre-500)] pl-3">
              {profile.verification.reviewerNote}
            </p>
          )}
          <p className="mt-2 text-[var(--color-ink-soft)]">{t("ver.changes.body")}</p>
        </div>
      ) : (
        <div className="mt-6 rounded-xl p-4 bg-[var(--color-cream-2)] border border-[var(--color-line)] text-sm text-[var(--color-ink-soft)]">
          {t("ver.status.current")} <b className="text-[var(--color-ink)]">{status}</b>
          {profile.verification?.reviewerNote && (
            <p className="mt-1">
              {t("ver.status.note")} {profile.verification.reviewerNote}
            </p>
          )}
        </div>
      )}

      {done && (
        <div className="mt-4 rounded-xl p-4 bg-[var(--color-sage-100)]/40 border border-[var(--color-sage-400)]/50 text-sm">
          {t("ver.done.worker")}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-5 rounded-2xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft"
      >
        <div>
          <Input
            label={t("ver.id.number")}
            name="idNumber"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value.replace(/[^\d]/g, ""))}
            placeholder={t("ver.id.numberPh")}
            required
            minLength={13}
            maxLength={13}
            inputMode="numeric"
          />
          {(() => {
            // Live structural feedback so workers fix typos before submitting.
            const clean = idNumber.replace(/\s/g, "");
            if (clean.length < 13) return null;
            const p = parseSaId(clean, { dob: profile.dateOfBirth, gender: profile.gender });
            const dobMismatch =
              profile.dateOfBirth && p.dob && profile.dateOfBirth.slice(0, 10) !== p.dob.slice(0, 10);
            if (!p.valid) {
              return (
                <p className="mt-1.5 text-xs text-[var(--color-brick)]">
                  ⚠ {p.errors[0] ?? t("ver.id.invalidShort")}
                </p>
              );
            }
            if (dobMismatch) {
              return (
                <p className="mt-1.5 text-xs text-[var(--color-ochre-700)]">
                  ⚠ This ID&apos;s date of birth doesn&apos;t match the one on your account. Double-check
                  you typed it correctly.
                </p>
              );
            }
            return (
              <p className="mt-1.5 text-xs text-[var(--color-sage-700)]">
                ✓ {t("ver.id.valid")}{p.dob ? ` · ${t("ver.id.born")} ${p.dob}` : ""}.
              </p>
            );
          })()}
        </div>

        <div>
          <p className="block text-sm font-medium text-[var(--color-ink)] mb-2">
            {t("ver.f.idPhoto")} <span className="text-[var(--color-brick)]">*</span>
          </p>
          <PhotoUploader
            traceName="upload_verification_doc"
            kind="verification"
            scopeId={user.uid}
            accept="image/*,application/pdf"
            label={idPhotoURL ? t("ver.f.idPhotoReplace") : t("ver.f.idPhotoUpload")}
            hint={t("ver.f.idPhotoHint")}
            initialPreview={previewFor("idPhotoURL", idPhotoURL)}
            onUploaded={(url, _file, path) => {
              setIdPhotoURL(path);
              setPreviews((p) => ({ ...p, idPhotoURL: url }));
              persistVerificationField("idPhotoURL", path);
            }}
          />
        </div>

        <div>
          <p className="block text-sm font-medium text-[var(--color-ink)] mb-2">
            {t("ver.f.selfie")}
          </p>
          <PhotoUploader
            traceName="upload_verification_doc"
            kind="verification"
            scopeId={user.uid}
            accept="video/*"
            label={selfieVideoURL ? t("ver.f.selfieReplace") : t("ver.f.selfieUpload")}
            hint={t("ver.f.selfieHint")}
            initialPreview={previewFor("selfieVideoURL", selfieVideoURL)}
            onUploaded={(url, _file, path) => {
              setSelfieVideoURL(path);
              setPreviews((p) => ({ ...p, selfieVideoURL: url }));
              persistVerificationField("selfieVideoURL", path);
            }}
          />
        </div>

        <Input
          label={t("ver.f.address")}
          name="addressLine"
          value={addressLine}
          onChange={(e) => setAddressLine(e.target.value)}
          placeholder={t("ver.f.addressPh")}
          required
        />

        <LocationPicker
          label={t("ver.f.locLabel")}
          hint={t("ver.f.locHint")}
          initial={home}
          onChange={(c) => setHome(c)}
        />

        <div>
          <p className="block text-sm font-medium text-[var(--color-ink)] mb-2">
            {t("ver.f.addrProof")} <span className="text-[var(--color-brick)]">*</span>
          </p>
          <PhotoUploader
            traceName="upload_verification_doc"
            kind="verification"
            scopeId={user.uid}
            accept="image/*,application/pdf"
            label={addressProofURL ? t("ver.f.addrProofReplace") : t("ver.f.addrProofUpload")}
            hint={t("ver.f.addrProofHint")}
            initialPreview={previewFor("addressProofURL", addressProofURL)}
            onUploaded={(url, _file, path) => {
              setAddressProofURL(path);
              setPreviews((p) => ({ ...p, addressProofURL: url }));
              persistVerificationField("addressProofURL", path);
            }}
          />
        </div>

        <Textarea
          label={t("ver.f.skills")}
          name="skillsSummary"
          value={skillsSummary}
          onChange={(e) => setSkillsSummary(e.target.value)}
          placeholder={t("ver.f.skillsPh")}
          required
        />

        <div>
          <p className="block text-sm font-medium text-[var(--color-ink)] mb-2">
            {t("ver.f.pastWork")}
          </p>
          {skillProofURLs.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {skillProofURLs.map((u, i) => {
                // Stored value may be a Storage path (new) or legacy URL.
                const display = u.startsWith("http") ? u : previews[u];
                return display ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={u}
                    src={display}
                    alt={`Past work ${i + 1}`}
                    className="w-20 h-20 rounded-lg object-cover border border-[var(--color-line)]"
                  />
                ) : (
                  <span
                    key={u}
                    className="w-20 h-20 rounded-lg border border-[var(--color-line)] bg-[var(--color-cream-2)] flex items-center justify-center text-[10px] text-[var(--color-ink-muted)] text-center px-1"
                  >
                    {t("ver.f.uploaded")}
                  </span>
                );
              })}
            </div>
          )}
          <PhotoUploader
            traceName="upload_verification_doc"
            kind="verification"
            scopeId={user.uid}
            accept="image/*"
            label={t("ver.f.addPhoto")}
            hint={t("ver.f.addPhotoHint")}
            onUploaded={(url, _file, path) => {
              const next = [...skillProofURLs, path];
              setSkillProofURLs(next);
              setPreviews((p) => ({ ...p, [path]: url }));
              persistVerificationField("skillProofURLs", next);
            }}
          />
        </div>

        <div className="rounded-xl p-5 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)]">
          <p className="block text-sm font-medium text-[var(--color-ink)] mb-1 flex items-center gap-2">
            <span aria-hidden>🥇</span> {t("ver.f.policeTitle")}
          </p>
          <p className="text-xs text-[var(--color-ink-muted)] mb-3 leading-relaxed">
            {t("ver.f.policeBody1")}{" "}
            <b>{t("ver.f.policeBadge")}</b> {t("ver.f.policeBody2")}
          </p>
          <PhotoUploader
            traceName="upload_verification_doc"
            kind="verification"
            scopeId={user.uid}
            accept="image/*,application/pdf"
            label={policeClearanceURL ? t("ver.f.policeReplace") : t("ver.f.policeUpload")}
            hint={t("ver.f.policeHint")}
            initialPreview={previewFor("policeClearanceURL", policeClearanceURL)}
            onUploaded={(url, _file, path) => {
              setPoliceClearanceURL(path);
              setPreviews((p) => ({ ...p, policeClearanceURL: url }));
              persistVerificationField("policeClearanceURL", path);
            }}
          />
        </div>

        <div>
          <p className="block text-sm font-medium text-[var(--color-ink)] mb-2">
            {t("ver.f.catsTitle")} <span className="text-[var(--color-brick)]">*</span>
          </p>
          <p className="text-xs text-[var(--color-ink-muted)] mb-2">
            {t("ver.f.catsHint")}
          </p>
          <CategorySkillsPicker
            categories={categories}
            skills={skills}
            onCategoriesChange={setCategories}
            onSkillsChange={setSkills}
          />
        </div>

        <label className="flex items-start gap-3 rounded-xl p-4 bg-[var(--color-cream-2)] border border-[var(--color-line)] cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-[var(--color-ochre-500)] flex-shrink-0"
          />
          <span className="text-xs text-[var(--color-ink-soft)] leading-relaxed">
            {t("ver.f.consentPre")}{" "}
            <Link href="/privacy" target="_blank" className="underline text-[var(--color-ink)]">
              {t("auth.consent.privacy")}
            </Link>
            {t("ver.f.consentPost")}
          </span>
        </label>

        {error && <p className="text-sm text-[var(--color-brick)]">{error}</p>}

        <Button type="submit" size="lg" variant="primary" className="w-full" loading={submitting} loadingText={t("ver.f.saving")}>
          {welcome ? t("ver.f.submitContinue") : t("ver.f.submitReview")}
        </Button>
        <p className="text-xs text-[var(--color-ink-muted)] text-center">
          {t("ver.f.truth")}
        </p>
      </form>
    </>
  );
}

/**
 * Identity verification for employers + businesses — REQUIRED since
 * 2026-07-08 (founder: workers deserve to know who's hiring them; the welcome
 * flow routes every role here and accounts stay pending until reviewed).
 * Reuses the same verificationStatus + private verification doc + admin
 * review pipeline as workers, but only asks for the identity core (SA ID
 * number + ID photo + selfie) — no skills/categories/address. Earns the
 * ✓ ID-verified badge that the EmployerTrust panel shows to workers.
 */
function EmployerVerificationForm() {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const welcome = useSearchParams().get("welcome") === "1";

  useEffect(() => {
    if (profile?.verificationStatus === "approved" && welcome) {
      router.replace("/");
    }
  }, [profile, welcome, router]);

  const [idNumber, setIdNumber] = useState("");
  const [idPhotoURL, setIdPhotoURL] = useState("");
  const [selfieVideoURL, setSelfieVideoURL] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const previewFor = (field: string, stored: string): string | undefined =>
    previews[field] ?? (stored.startsWith("http") ? stored : undefined);

  // See persistVerificationField above: persist the uploaded file so it
  // survives a reload, but DON'T stamp submittedAt — only the final Submit
  // marks the account as submitted and surfaces it in the admin queue.
  const persistField = async (field: string, value: unknown) => {
    if (!user) return;
    try {
      await setDoc(
        doc(getDb(), "users", user.uid, "private", "profile"),
        { verification: { [field]: value } },
        { merge: true },
      );
    } catch {
      /* silent — final Submit will catch it */
    }
  };

  useEffect(() => {
    if (!profile?.verification) return;
    const v = profile.verification;
    setIdNumber(v.idNumber ?? "");
    setIdPhotoURL(v.idPhotoURL ?? "");
    setSelfieVideoURL(v.selfieVideoURL ?? "");
    if (v.consentAt) setConsent(true);
    const hasPath = [v.idPhotoURL, v.selfieVideoURL].some((x) => x && !x.startsWith("http"));
    if (hasPath) {
      const fn = httpsCallable<
        { uid?: string },
        { verification: Record<string, string | string[] | null> }
      >(getFunctionsInstance(), "getVerificationPayload");
      fn({})
        .then((res) => {
          const r = res.data?.verification ?? {};
          const next: Record<string, string> = {};
          for (const f of ["idPhotoURL", "selfieVideoURL"]) {
            if (typeof r[f] === "string") next[f] = r[f] as string;
          }
          setPreviews((p) => ({ ...next, ...p }));
        })
        .catch(() => {});
    }
  }, [profile]);

  if (!user || !profile) return null;
  const status = profile.verificationStatus ?? "none";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError(t("ver.err.consent"));
      return;
    }
    if (!idPhotoURL) {
      setError(t("ver.err.idPhoto"));
      return;
    }
    const idCheck = checkSaId(idNumber, { dob: profile.dateOfBirth, gender: profile.gender });
    if (!idCheck.valid) {
      setError(`${t("ver.err.idInvalid")} ${idCheck.flags[0] ?? ""}`.trim());
      return;
    }
    const ageOnId = ageFromDob(idCheck.dob);
    if (ageOnId !== undefined && ageOnId < 18) {
      setError(t("ver.err.under18"));
      return;
    }
    setSubmitting(true);
    try {
      await setDoc(
        doc(getDb(), "users", user.uid, "private", "profile"),
        {
          verification: {
            idNumber,
            idPhotoURL: idPhotoURL || null,
            selfieVideoURL: selfieVideoURL || null,
            idCheck,
          },
        },
        { merge: true },
      );
      await updateDoc(doc(getDb(), "users", user.uid), {
        // One-step onboarding — mark profile complete so nothing re-routes them.
        ...(profile.profileCompletedAt ? {} : { profileCompletedAt: Date.now() }),
        "verification.submittedAt": Date.now(),
        "verification.consentAt": Date.now(),
        "verification.consentVersion": CONSENT_VERSION,
        "verification.idCheckVerdict": idCheckVerdict(idCheck),
      });
      setDone(true);
      await refreshProfile();
      if (welcome) router.push("/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ver.err.couldNotSubmit"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow={t("ver.emp.hero.eyebrow")}
        eyebrowTone="sage"
        title={t("ver.emp.hero.title")}
        intro={t("ver.emp.hero.intro")}
      />

      <div className="mt-6 rounded-xl p-4 bg-[var(--color-cream-2)] border border-[var(--color-line)] text-sm text-[var(--color-ink-soft)]">
        {t("ver.status.current")} <b className="text-[var(--color-ink)]">{status}</b>
        {profile.verification?.reviewerNote && (
          <p className="mt-1">{t("ver.status.note")} {profile.verification.reviewerNote}</p>
        )}
      </div>

      {done && (
        <div className="mt-4 rounded-xl p-4 bg-[var(--color-sage-100)]/40 border border-[var(--color-sage-400)]/50 text-sm">
          {t("ver.emp.done")}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-5 rounded-2xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft"
      >
        <div>
          <Input
            label={t("ver.id.number")}
            name="idNumber"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value.replace(/[^\d]/g, ""))}
            placeholder={t("ver.id.numberPh")}
            required
            minLength={13}
            maxLength={13}
            inputMode="numeric"
          />
          {(() => {
            const clean = idNumber.replace(/\s/g, "");
            if (clean.length < 13) return null;
            const p = parseSaId(clean, { dob: profile.dateOfBirth, gender: profile.gender });
            const dobMismatch =
              profile.dateOfBirth && p.dob && profile.dateOfBirth.slice(0, 10) !== p.dob.slice(0, 10);
            if (!p.valid) {
              return (
                <p className="mt-1.5 text-xs text-[var(--color-brick)]">
                  ⚠ {p.errors[0] ?? t("ver.id.invalidShort")}
                </p>
              );
            }
            if (dobMismatch) {
              return (
                <p className="mt-1.5 text-xs text-[var(--color-ochre-700)]">
                  ⚠ This ID&apos;s date of birth doesn&apos;t match your account. Double-check it.
                </p>
              );
            }
            return (
              <p className="mt-1.5 text-xs text-[var(--color-sage-700)]">
                ✓ {t("ver.id.valid")}{p.dob ? ` · ${t("ver.id.born")} ${p.dob}` : ""}.
              </p>
            );
          })()}
        </div>

        <div>
          <p className="block text-sm font-medium text-[var(--color-ink)] mb-2">{t("ver.f.idPhoto")}</p>
          <PhotoUploader
            traceName="upload_verification_doc"
            kind="verification"
            scopeId={user.uid}
            accept="image/*,application/pdf"
            label={idPhotoURL ? t("ver.f.idPhotoReplace") : t("ver.f.idPhotoUpload")}
            hint={t("ver.f.idPhotoHintEmp")}
            initialPreview={previewFor("idPhotoURL", idPhotoURL)}
            onUploaded={(url, _file, path) => {
              setIdPhotoURL(path);
              setPreviews((p) => ({ ...p, idPhotoURL: url }));
              persistField("idPhotoURL", path);
            }}
          />
        </div>

        <div>
          <p className="block text-sm font-medium text-[var(--color-ink)] mb-2">
            {t("ver.f.selfieEmp")}
          </p>
          <PhotoUploader
            traceName="upload_verification_doc"
            kind="verification"
            scopeId={user.uid}
            accept="video/*"
            label={selfieVideoURL ? t("ver.f.selfieReplace") : t("ver.f.selfieUpload")}
            hint={t("ver.f.selfieHintEmp")}
            initialPreview={previewFor("selfieVideoURL", selfieVideoURL)}
            onUploaded={(url, _file, path) => {
              setSelfieVideoURL(path);
              setPreviews((p) => ({ ...p, selfieVideoURL: url }));
              persistField("selfieVideoURL", path);
            }}
          />
        </div>

        <label className="flex items-start gap-3 rounded-xl p-4 bg-[var(--color-cream-2)] border border-[var(--color-line)] cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-[var(--color-ochre-500)] flex-shrink-0"
          />
          <span className="text-xs text-[var(--color-ink-soft)] leading-relaxed">
            {t("ver.f.consentEmpPre")}{" "}
            <Link href="/privacy" target="_blank" className="underline text-[var(--color-ink)]">
              {t("auth.consent.privacy")}
            </Link>
            {t("ver.f.consentEmpPost")}
          </span>
        </label>

        {error && <p className="text-sm text-[var(--color-brick)]">{error}</p>}

        <Button type="submit" size="lg" variant="primary" className="w-full" loading={submitting} loadingText={t("ver.f.saving")}>
          {t("ver.f.submitReview")}
        </Button>
      </form>
    </>
  );
}

function VerificationOverview({ signedIn }: { signedIn: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <PageHero
        eyebrow={t("ver.ov.hero.eyebrow")}
        eyebrowTone="sage"
        title={t("ver.ov.hero.title")}
        intro={t("ver.ov.hero.intro")}
      />

      <section className="mt-8 space-y-6 text-[var(--color-ink-soft)] leading-relaxed">
        <div className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
          <h2 className="font-display text-2xl text-[var(--color-ink)]">
            {t("ver.ov.ask.h")}
          </h2>
          <ul className="mt-3 list-disc ml-6 space-y-2">
            <li>{t("ver.ov.ask.li1")}</li>
            <li>{t("ver.ov.ask.li2")}</li>
            <li>{t("ver.ov.ask.li3")}</li>
            <li>{t("ver.ov.ask.li4")}</li>
            <li>{t("ver.ov.ask.li5")}</li>
            <li>{t("ver.ov.ask.li6")}</li>
            <li>{t("ver.ov.ask.li7")}</li>
          </ul>
        </div>

        <div className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
          <h2 className="font-display text-2xl text-[var(--color-ink)]">
            {t("ver.ov.proc.h")}
          </h2>
          <ol className="mt-3 list-decimal ml-6 space-y-2">
            <li>{t("ver.ov.proc.li1")}</li>
            <li>{t("ver.ov.proc.li2")}</li>
            <li>{t("ver.ov.proc.li3")}</li>
            <li>{t("ver.ov.proc.li4")}</li>
          </ol>
          <p className="mt-3 text-sm">{t("ver.ov.proc.note")}</p>
        </div>

        <div className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
          <h2 className="font-display text-2xl text-[var(--color-ink)]">
            {t("ver.ov.why.h")}
          </h2>
          <p className="mt-3">{t("ver.ov.why.body")}</p>
        </div>

        <div className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft">
          <h2 className="font-display text-2xl text-[var(--color-ink)]">
            {t("ver.ov.docs.h")}
          </h2>
          <p className="mt-3">
            {t("ver.ov.docs.pre")}{" "}
            <Link href="/privacy" className="underline decoration-[var(--color-ochre-300)]">
              {t("auth.consent.privacy")}
            </Link>{" "}
            {t("ver.ov.docs.post")}
          </p>
        </div>

        <div className="rounded-2xl p-7 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)]">
          <h2 className="font-display text-2xl text-[var(--color-ink)]">
            {t("ver.ov.ready.h")}
          </h2>
          <p className="mt-2 text-sm">{t("ver.ov.ready.body")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {signedIn ? (
              <Link
                href="/profile"
                className="px-6 py-3 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] font-medium hover:opacity-90 text-sm"
              >
                {t("ver.ov.ready.gotoProfile")}
              </Link>
            ) : (
              <>
                <Link
                  href="/signup?role=worker"
                  className="px-6 py-3 rounded-pill bg-[var(--color-ink)] text-[var(--color-cream)] font-medium hover:opacity-90 text-sm"
                >
                  {t("hiw.wk.cta")}
                </Link>
                <Link
                  href="/signin?next=/verification"
                  className="px-6 py-3 rounded-pill border border-[var(--color-ink)]/30 text-[var(--color-ink)] font-medium hover:bg-white/40 text-sm"
                >
                  {t("ver.ov.ready.already")}
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

export default function VerificationPage() {
  const { t } = useTranslation();
  return (
    <Frame>
      <Suspense fallback={<p className="text-[var(--color-ink-muted)]">{t("signup.loading")}</p>}>
        <VerificationInner />
      </Suspense>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-14 max-w-2xl">{children}</Container>
      </main>
      <Footer />
    </>
  );
}
