"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { PageSkeleton } from "@/components/Skeleton";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import Avatar from "@/components/Avatar";
import ReputationBadges from "@/components/ReputationBadges";
import PhotoUploader from "@/components/PhotoUploader";
import LocationPicker from "@/components/LocationPicker";
import CategorySkillsPicker from "@/components/CategorySkillsPicker";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { buildExport, downloadExport, requestAccountDeletion } from "@/lib/popia";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { track } from "@/lib/analytics";
import { approxCoord, computeBadges, ageFromDob, GENDER_OPTIONS, type Gender, type PortfolioQualification } from "@/lib/types";
import { updateProfile as fbUpdateProfile } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

function ProfileInner() {
  const router = useRouter();
  const search = useSearchParams();
  const welcome = search.get("welcome") === "1";
  const { user, profile, loading, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"" | Gender>("");
  const [home, setHome] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  // Work categories + specific skills (workers only)
  const [categories, setCategories] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  // Portfolio
  const [tagline, setTagline] = useState("");
  const [qualifications, setQualifications] = useState<PortfolioQualification[]>([]);
  const [cvURL, setCvURL] = useState("");
  const [portfolioImageURLs, setPortfolioImageURLs] = useState<string[]>([]);
  const [portfolioVideoURLs, setPortfolioVideoURLs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/signin?next=/profile");
  }, [loading, user, router]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? "");
      setPhotoURL(profile.photoURL ?? "");
      setBio(profile.bio ?? "");
      setPhone(profile.phone ?? "");
      setGender(profile.gender ?? "");
      setCategories(profile.categories ?? []);
      setSkills(profile.skills ?? []);
      setTagline(profile.tagline ?? "");
      setQualifications(profile.qualifications ?? []);
      setCvURL(profile.cvURL ?? "");
      setPortfolioImageURLs(profile.portfolioImageURLs ?? []);
      setPortfolioVideoURLs(profile.portfolioVideoURLs ?? []);
      if (
        typeof profile.homeLat === "number"
        && typeof profile.homeLng === "number"
      ) {
        setHome({
          lat: profile.homeLat,
          lng: profile.homeLng,
          accuracy: profile.homeAccuracy,
        });
      }
    }
  }, [profile]);

  if (loading || !user || !profile) {
    return <PageSkeleton />;
  }

  const badges = computeBadges(profile);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const trimmedPhoto = photoURL.trim();
      if (trimmedPhoto && !/^https?:\/\//i.test(trimmedPhoto)) {
        setError("Photo URL must start with http:// or https://");
        return;
      }
      // Drop empty qualification rows (a placeholder title means "delete me")
      const cleanQuals = qualifications
        .map((q) => ({
          title: q.title.trim(),
          issuer: q.issuer?.trim() ?? "",
          year: q.year?.trim() ?? "",
        }))
        .filter((q) => q.title.length > 0);

      await updateDoc(doc(getDb(), "users", profile.uid), {
        displayName: displayName.trim() || profile.displayName,
        photoURL: trimmedPhoto || null,
        bio: bio.trim(),
        phone: phone.trim(),
        ...(gender ? { gender } : {}),
        ...(profile.role === "worker" ? { categories, skills } : {}),
        tagline: tagline.trim(),
        qualifications: cleanQuals,
        cvURL: cvURL || null,
        portfolioImageURLs,
        portfolioVideoURLs,
        ...(home
          ? {
              // PUBLIC: rounded ~1 km coords only — exact home goes to the
              // private doc below (Phase B: no exact home on the public doc).
              approxLat: approxCoord(home.lat),
              approxLng: approxCoord(home.lng),
            }
          : {}),
        // Mark profile as completed the first time around so the
        // gate stops redirecting them back to /profile.
        ...(profile.profileCompletedAt
          ? {}
          : { profileCompletedAt: Date.now() }),
      });
      if (home) {
        await setDoc(
          doc(getDb(), "users", profile.uid, "private", "profile"),
          {
            homeLat: home.lat,
            homeLng: home.lng,
            homeAccuracy: home.accuracy ?? null,
            homePinnedAt: Date.now(),
          },
          { merge: true },
        );
      }
      // Mirror to Firebase Auth user
      try {
        await fbUpdateProfile(getFirebaseAuth().currentUser!, {
          displayName: displayName.trim() || profile.displayName,
          photoURL: trimmedPhoto || null,
        });
      } catch {
        /* ignore */
      }
      setSavedAt(Date.now());
      if (!profile.profileCompletedAt) {
        track("profile_completed", { role: profile.role });
      }
      // Pull latest profile back into context so AccountGate sees the new
      // profileCompletedAt and doesn't bounce the user back here.
      await refreshProfile();
      // Brand-new user finished initial profile. EVERY role now goes on to
      // identity verification (founder 2026-07-08: employers must verify ID
      // too — workers let them into their day and deserve to know who they
      // are). Workers get the full credential form; employers/businesses get
      // the identity-core form on the same page.
      if (welcome) {
        router.push("/verification?welcome=1");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {welcome && (
        <div className="mb-6 rounded-xl p-5 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] text-sm text-[var(--color-ink-soft)] animate-slide-up">
          <p className="font-medium text-[var(--color-ink)]">
            Polish your profile
          </p>
          <p className="mt-1">
            Add a photo, a bio and your portfolio so you stand out — this is
            optional. Account approval runs off your verification documents.
          </p>
        </div>
      )}
      <Badge tone="ink">Your profile</Badge>
      <h1 className="mt-4 font-display text-4xl sm:text-5xl tracking-tight">
        {welcome ? "Tell us about yourself." : "How others see you."}
      </h1>

      <div className="mt-8 grid lg:grid-cols-12 gap-8">
        {/* Live preview */}
        <aside className="lg:col-span-4">
          <div className="rounded-2xl p-6 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft text-center">
            <div className="flex justify-center">
              <Avatar
                name={displayName || profile.displayName}
                photoURL={photoURL || profile.photoURL}
                size="xl"
              />
            </div>
            <h2 className="mt-4 font-display text-2xl">
              {displayName || profile.displayName}
            </h2>
            <p className="text-xs text-[var(--color-ink-muted)] capitalize">
              {profile.role}
            </p>
            {badges.length > 0 && (
              <div className="mt-4 flex justify-center">
                <ReputationBadges badges={badges} />
              </div>
            )}
            <p className="mt-4 text-sm text-[var(--color-ink-soft)] italic">
              {bio || (
                <span className="text-[var(--color-ink-muted)]">
                  Your bio will appear here.
                </span>
              )}
            </p>
          </div>

          {profile.role === "worker" && profile.verificationStatus !== "approved" && (
            <p className="mt-4 text-xs text-[var(--color-ink-muted)] text-center">
              Get verified at{" "}
              <Link href="/verification" className="underline">
                /verification
              </Link>{" "}
              to unlock the Verified badge.
            </p>
          )}
        </aside>

        {/* Form */}
        <form
          onSubmit={onSubmit}
          className="lg:col-span-8 space-y-5 rounded-2xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft"
        >
          <Input
            label="Display name"
            name="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How your name appears to others"
            required
          />

          <div>
            <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
              Profile photo
            </label>
            <PhotoUploader
              kind="avatar"
              scopeId={profile.uid}
              accept="image/*"
              label={photoURL ? "Change photo" : "Upload photo"}
              hint="JPG/PNG, up to 5 MB. Used in your chat bubbles and on offer cards."
              initialPreview={photoURL || profile.photoURL}
              onUploaded={(url) => setPhotoURL(url)}
            />
          </div>

          <Input
            label="Phone number"
            name="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+27 …"
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                Gender (optional)
              </label>
              <select
                name="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender | "")}
                className="w-full px-4 py-3 rounded-md bg-[var(--color-paper)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ochre-300)] text-sm text-[var(--color-ink)]"
              >
                <option value="">— Select —</option>
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                Age
              </label>
              <div className="px-4 py-3 rounded-md bg-[var(--color-cream-2)] border border-[var(--color-line)] text-sm text-[var(--color-ink-soft)]">
                {ageFromDob(profile.dateOfBirth) != null
                  ? `${ageFromDob(profile.dateOfBirth)} years`
                  : "Set at signup"}
              </div>
              <p className="text-xs text-[var(--color-ink-muted)] mt-1">
                Calculated from your date of birth — not editable here.
              </p>
            </div>
          </div>

          <LocationPicker
            label={
              profile.role === "worker"
                ? "Your home base (so jobs near you show first)"
                : "Your home base (helps workers find your jobs)"
            }
            hint="One-tap — uses your phone or laptop's GPS. You can re-pin later."
            initial={home}
            onChange={(c) => setHome(c)}
          />

          <Textarea
            label={profile.role === "worker" ? "About you / your work" : "About you"}
            name="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={
              profile.role === "worker"
                ? "Tell employers what you specialise in, your years of experience, languages you speak…"
                : "A short note about you (optional)."
            }
            rows={4}
            maxLength={500}
          />

          {/* ---------- WORK CATEGORIES & SKILLS (workers) ---------- */}
          {profile.role === "worker" && (
            <fieldset className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-cream-2)] p-5 space-y-4">
              <legend className="px-2 text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
                Work categories &amp; skills
              </legend>
              <p className="text-xs text-[var(--color-ink-muted)] -mt-2">
                Pick what you do so employers searching the worker directory
                find you — first the broad categories, then your specific
                skills (e.g. Hair, Plumbing, Bakkie hire).
              </p>
              <CategorySkillsPicker
                categories={categories}
                skills={skills}
                onCategoriesChange={setCategories}
                onSkillsChange={setSkills}
              />
            </fieldset>
          )}

          {/* ---------- PORTFOLIO ---------- */}
          <fieldset className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-cream-2)] p-5 space-y-5">
            <legend className="px-2 text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
              Portfolio
            </legend>
            <p className="text-xs text-[var(--color-ink-muted)] -mt-2">
              {profile.role === "worker"
                ? "Show employers what you can do — a tagline, qualifications, a CV, and photos / videos of past work. Profiles with portfolios get hired far more often."
                : "Add a tagline, any qualifications, and a few photos so workers know who they're working for. Optional but helps build trust."}
            </p>

            <Input
              label="Tagline (one line)"
              name="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={120}
              placeholder={
                profile.role === "worker"
                  ? "e.g. Reliable gardener · 8 years in Linden"
                  : "e.g. Small property in Greenside — friendly to first-time workers"
              }
              hint={`${tagline.length}/120`}
            />

            {/* Qualifications */}
            <div>
              <p className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                Qualifications, certifications & training
              </p>
              {qualifications.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {qualifications.map((q, i) => (
                    <li
                      key={i}
                      className="grid grid-cols-12 gap-2 items-start rounded-lg p-2 bg-[var(--color-paper)] border border-[var(--color-line)]"
                    >
                      <input
                        type="text"
                        value={q.title}
                        placeholder="e.g. Trade Test Plumbing"
                        aria-label="Qualification title"
                        onChange={(e) =>
                          setQualifications((qs) =>
                            qs.map((x, j) => (i === j ? { ...x, title: e.target.value } : x)),
                          )
                        }
                        className="col-span-12 sm:col-span-5 px-3 py-2 rounded-md bg-transparent border border-[var(--color-line)] text-sm focus:border-[var(--color-ochre-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ochre-300)]"
                      />
                      <input
                        type="text"
                        value={q.issuer ?? ""}
                        placeholder="Issuer (e.g. Northlink TVET)"
                        aria-label="Qualification issuer"
                        onChange={(e) =>
                          setQualifications((qs) =>
                            qs.map((x, j) => (i === j ? { ...x, issuer: e.target.value } : x)),
                          )
                        }
                        className="col-span-8 sm:col-span-5 px-3 py-2 rounded-md bg-transparent border border-[var(--color-line)] text-sm focus:border-[var(--color-ochre-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ochre-300)]"
                      />
                      <input
                        type="text"
                        value={q.year ?? ""}
                        placeholder="Year"
                        aria-label="Qualification year"
                        onChange={(e) =>
                          setQualifications((qs) =>
                            qs.map((x, j) => (i === j ? { ...x, year: e.target.value } : x)),
                          )
                        }
                        className="col-span-3 sm:col-span-1 px-3 py-2 rounded-md bg-transparent border border-[var(--color-line)] text-sm focus:border-[var(--color-ochre-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ochre-300)]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setQualifications((qs) => qs.filter((_, j) => j !== i))
                        }
                        aria-label="Remove this qualification"
                        className="col-span-1 text-[var(--color-ink-muted)] hover:text-[var(--color-brick)] text-lg flex justify-center items-center"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() =>
                  setQualifications((qs) => [...qs, { title: "", issuer: "", year: "" }])
                }
                className="text-sm px-4 py-2 rounded-pill border border-dashed border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-paper)]"
              >
                + Add qualification
              </button>
            </div>

            {/* CV */}
            <div>
              <p className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                CV (optional)
              </p>
              {cvURL && (
                <p className="mb-2 text-sm">
                  <a
                    href={cvURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-[var(--color-ochre-600)]"
                  >
                    View current CV
                  </a>
                  <button
                    type="button"
                    onClick={() => setCvURL("")}
                    className="ml-3 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-brick)] underline"
                  >
                    Remove
                  </button>
                </p>
              )}
              <PhotoUploader
                kind="portfolio"
                scopeId={profile.uid}
                accept="application/pdf,image/*"
                label={cvURL ? "Replace CV" : "Upload CV"}
                hint="PDF preferred. Max 50 MB. Visible to anyone signed in viewing your profile."
                onUploaded={(url) => setCvURL(url)}
              />
            </div>

            {/* Portfolio photos */}
            <div>
              <p className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                Showcase photos
              </p>
              {portfolioImageURLs.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {portfolioImageURLs.map((u, i) => (
                    <div key={u} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={u}
                        alt={`Showcase ${i + 1}`}
                        className="w-24 h-24 rounded-lg object-cover border border-[var(--color-line)]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPortfolioImageURLs((arr) => arr.filter((x) => x !== u))
                        }
                        aria-label="Remove photo"
                        className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-[var(--color-brick-solid)] text-white text-xs flex items-center justify-center shadow"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <PhotoUploader
                kind="portfolio"
                scopeId={profile.uid}
                accept="image/*"
                label="Add a photo"
                hint="JPG / PNG. Add as many as you like, one at a time."
                onUploaded={(url) =>
                  setPortfolioImageURLs((arr) => [...arr, url])
                }
              />
            </div>

            {/* Portfolio videos */}
            <div>
              <p className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                Showcase videos (optional)
              </p>
              {portfolioVideoURLs.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {portfolioVideoURLs.map((u) => (
                    <li
                      key={u}
                      className="flex items-center justify-between gap-3 rounded-lg p-3 bg-[var(--color-paper)] border border-[var(--color-line)] text-sm"
                    >
                      <a
                        href={u}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-[var(--color-ochre-600)] truncate"
                      >
                        {decodeURIComponent(u.split("/").pop()?.split("?")[0] ?? "video")}
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          setPortfolioVideoURLs((arr) => arr.filter((x) => x !== u))
                        }
                        aria-label="Remove video"
                        className="text-[var(--color-ink-muted)] hover:text-[var(--color-brick)] text-lg"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <PhotoUploader
                kind="portfolio"
                scopeId={profile.uid}
                accept="video/*"
                label="Add a video"
                hint="Keep clips short — 30 to 60 seconds is plenty. Max 50 MB each."
                onUploaded={(url) =>
                  setPortfolioVideoURLs((arr) => [...arr, url])
                }
              />
            </div>
          </fieldset>

          {error && <p className="text-sm text-[var(--color-brick)]">{error}</p>}
          {savedAt && !error && (
            <p className="text-sm text-[var(--color-sage-700)]">Saved ✓</p>
          )}

          <Button type="submit" size="lg" variant="primary" loading={saving} loadingText="Saving…">
            {welcome ? "Save and continue" : "Save changes"}
          </Button>
        </form>

        {!welcome && (
          <div className="lg:col-span-12">
            <DataRightsCard uid={profile.uid} displayName={profile.displayName} />
          </div>
        )}
      </div>
    </>
  );
}

function DataRightsCard({ uid, displayName }: { uid: string; displayName: string }) {
  const [exporting, setExporting] = useState(false);
  const [requestingDelete, setRequestingDelete] = useState(false);
  const [done, setDone] = useState<"export" | "delete" | null>(null);
  const confirm = useConfirm();

  const onExport = async () => {
    setExporting(true);
    try {
      const data = await buildExport(uid);
      downloadExport(data);
      setDone("export");
    } finally {
      setExporting(false);
    }
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: "Request account deletion?",
      body: (
        <>
          Workit will send your request to the team for review. You&apos;ll be
          contacted within 7 days. Active jobs may need to be wound down before
          deletion completes.
        </>
      ),
      tone: "danger",
      confirmLabel: "Yes, request deletion",
      cancelLabel: "Not now",
    });
    if (!ok) return;
    setRequestingDelete(true);
    try {
      await requestAccountDeletion({ uid, displayName });
      setDone("delete");
    } finally {
      setRequestingDelete(false);
    }
  };

  return (
    <section className="mt-8 rounded-2xl p-6 bg-[var(--color-cream-2)] border border-[var(--color-line)]">
      <h2 className="font-display text-xl">Your data rights</h2>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
        Under the Protection of Personal Information Act (POPIA), you have the
        right to a copy of your data and the right to ask us to delete it.
      </p>
      {done === "export" && (
        <p className="mt-3 text-sm text-[var(--color-sage-700)]">
          ✓ Downloaded. Check your downloads folder for{" "}
          <span className="font-mono">workit-data-…json</span>.
        </p>
      )}
      {done === "delete" && (
        <p className="mt-3 text-sm text-[var(--color-sage-700)]">
          ✓ Request received. We&apos;ll email you within 7 days.
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={onExport} variant="outline" size="md" loading={exporting} loadingText="Preparing…">
          Download my data
        </Button>
        <Button
          onClick={onDelete}
          variant="ghost"
          size="md"
          className="!text-[var(--color-brick)]"
          loading={requestingDelete}
          loadingText="Sending…"
        >
          Request account deletion
        </Button>
      </div>
    </section>
  );
}

export default function ProfilePage() {
  return (
    <Frame>
      <Suspense fallback={<p className="text-[var(--color-ink-muted)]">Loading…</p>}>
        <ProfileInner />
      </Suspense>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-14 max-w-5xl">{children}</Container>
      </main>
      <Footer />
    </>
  );
}
