"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import PageHero from "@/components/PageHero";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import PhotoUploader from "@/components/PhotoUploader";
import { useAuth } from "@/contexts/AuthContext";
import { getDb } from "@/lib/firebase";
import { CATEGORIES, isBusiness, type CategoryId } from "@/lib/types";

export default function BusinessEditPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Container className="py-12 max-w-2xl">
          <BusinessEditInner />
        </Container>
      </main>
      <Footer />
    </>
  );
}

function BusinessEditInner() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [logoURL, setLogoURL] = useState("");
  const [categories, setCategories] = useState<CategoryId[]>([]);
  const [areaServed, setAreaServed] = useState("");
  const [website, setWebsite] = useState("");
  const [publicPhone, setPublicPhone] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [photoURLs, setPhotoURLs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Registration-verification (optional Gold-tier badge)
  const [regNumber, setRegNumber] = useState("");
  const [proofURL, setProofURL] = useState("");
  const [vSubmitting, setVSubmitting] = useState(false);
  const [vError, setVError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.businessName ?? "");
    setTagline(profile.businessTagline ?? "");
    setDescription(profile.businessDescription ?? "");
    setLogoURL(profile.businessLogoURL ?? "");
    setCategories(profile.businessCategories ?? []);
    setAreaServed(profile.businessAreaServed ?? "");
    setWebsite(profile.businessWebsite ?? "");
    setPublicPhone(profile.businessPublicPhone ?? "");
    setPublicEmail(profile.businessPublicEmail ?? "");
    setPhotoURLs(profile.businessPhotoURLs ?? []);
    setRegNumber(profile.businessVerification?.registrationNumber ?? "");
    setProofURL(profile.businessVerification?.registrationProofURL ?? "");
  }, [profile]);

  if (loading) return <p className="text-[var(--color-ink-muted)]">Loading…</p>;

  if (!user) {
    return (
      <p>
        Please <Link href="/signin" className="underline">sign in</Link> to edit your business profile.
      </p>
    );
  }

  // Business accounts (or admins) only.
  if (!isBusiness(profile?.role) && profile?.role !== "admin") {
    return (
      <div className="rounded-2xl p-8 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft text-center">
        <h1 className="font-display text-2xl tracking-tight mb-2">This page is for business accounts</h1>
        <p className="text-sm text-[var(--color-ink-soft)]">
          Your account isn&apos;t a business account.{" "}
          <Link href="/account" className="underline">Back to your account</Link>.
        </p>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please add your business name.");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(getDb(), "users", user.uid), {
        businessName: name.trim(),
        businessTagline: tagline.trim() || null,
        businessDescription: description.trim() || null,
        businessLogoURL: logoURL || null,
        businessCategories: categories,
        businessAreaServed: areaServed.trim() || null,
        businessWebsite: website.trim() || null,
        businessPublicPhone: publicPhone.trim() || null,
        businessPublicEmail: publicEmail.trim() || null,
        businessPhotoURLs: photoURLs,
        // Mark profile setup done so the onboarding gate is satisfied.
        profileCompletedAt: profile?.profileCompletedAt ?? Date.now(),
      });
      await refreshProfile();
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const vStatus = profile?.businessVerification?.status ?? "none";

  const submitVerification = async () => {
    if (!user) return;
    setVError(null);
    if (!regNumber.trim() || !proofURL) {
      setVError("Add your registration number and upload proof of registration.");
      return;
    }
    setVSubmitting(true);
    try {
      await updateDoc(doc(getDb(), "users", user.uid), {
        businessVerification: {
          registrationNumber: regNumber.trim(),
          registrationProofURL: proofURL,
          status: "pending",
          submittedAt: Date.now(),
        },
      });
      await refreshProfile();
    } catch (err) {
      setVError(err instanceof Error ? err.message : "Could not submit.");
    } finally {
      setVSubmitting(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Business profile"
        eyebrowTone="ochre"
        title="Set up your business profile."
        intro="This is what workers see when they consider your jobs — and how you'll appear in the business directory. Make it trustworthy."
      />

      {done && (
        <div className="mt-4 rounded-xl p-4 bg-[var(--color-sage-100)]/40 border border-[var(--color-sage-400)]/50 text-sm flex items-center justify-between gap-3">
          <span>Saved.</span>
          {user && (
            <Link href={`/business?id=${user.uid}`} className="underline font-medium" target="_blank">
              View public profile →
            </Link>
          )}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-5 rounded-2xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft"
      >
        <div>
          <p className="block text-sm font-medium text-[var(--color-ink)] mb-2">Logo</p>
          <PhotoUploader
            kind="avatar"
            scopeId={user.uid}
            accept="image/*"
            label={logoURL ? "Replace logo" : "Upload logo"}
            hint="A square logo looks best. Shown on your jobs + profile."
            initialPreview={logoURL}
            onUploaded={(url) => setLogoURL(url)}
          />
        </div>

        <Input
          label="Business name"
          name="businessName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sparkle Cleaning Co."
          required
        />

        <Input
          label="Tagline"
          name="businessTagline"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="One line — e.g. Fast, friendly cleaning across the East Rand"
        />

        <Textarea
          label="About your business"
          name="businessDescription"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What you do, how long you've been going, what makes you reliable."
        />

        <div>
          <p className="block text-sm font-medium text-[var(--color-ink)] mb-2">What you do</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const active = categories.includes(c.id);
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() =>
                    setCategories((cs) => (active ? cs.filter((x) => x !== c.id) : [...cs, c.id]))
                  }
                  className={`px-4 py-2 rounded-pill text-sm transition-colors ${
                    active
                      ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                      : "bg-[var(--color-paper)] border border-[var(--color-line)] text-[var(--color-ink-soft)]"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label="Areas you serve"
          name="businessAreaServed"
          value={areaServed}
          onChange={(e) => setAreaServed(e.target.value)}
          placeholder="e.g. Sandton, Midrand, Fourways"
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Website (optional)"
            name="businessWebsite"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://…"
          />
          <Input
            label="Public phone (optional)"
            name="businessPublicPhone"
            value={publicPhone}
            onChange={(e) => setPublicPhone(e.target.value)}
            placeholder="+27 …"
          />
        </div>
        <Input
          label="Public email (optional)"
          name="businessPublicEmail"
          type="email"
          value={publicEmail}
          onChange={(e) => setPublicEmail(e.target.value)}
          placeholder="hello@yourbusiness.co.za"
        />

        <div>
          <p className="block text-sm font-medium text-[var(--color-ink)] mb-2">
            Photos of your work (optional)
          </p>
          {photoURLs.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {photoURLs.map((u, i) => (
                <div key={u} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u}
                    alt={`Work ${i + 1}`}
                    className="w-20 h-20 rounded-lg object-cover border border-[var(--color-line)]"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotoURLs((p) => p.filter((x) => x !== u))}
                    aria-label="Remove photo"
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--color-ink)] text-[var(--color-cream)] text-xs flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <PhotoUploader
            kind="portfolio"
            scopeId={user.uid}
            accept="image/*"
            label="Add a photo"
            hint="Showcase past jobs. Add as many as you like, one at a time."
            onUploaded={(url) => setPhotoURLs((p) => [...p, url])}
          />
        </div>

        {error && <p className="text-sm text-[var(--color-brick)]">{error}</p>}

        <Button type="submit" size="lg" variant="primary" className="w-full" loading={saving} loadingText="Saving…">
          Save business profile
        </Button>
      </form>

      {/* Registration verification — the "Verified business" trust badge */}
      <div className="mt-6 rounded-2xl p-7 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)]">
        <div className="flex items-center gap-2 mb-2">
          <span aria-hidden>✅</span>
          <h2 className="font-display text-xl">Get the Verified business badge</h2>
        </div>
        <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
          Submit your company registration (CIPC) and we&apos;ll review it. Verified
          businesses stand out in the directory and reassure workers it&apos;s safe to
          take your jobs. Your documents are private — only the review team sees them.
        </p>

        {vStatus === "approved" ? (
          <p className="mt-4 text-sm font-medium text-[var(--color-sage-700)]">
            ✓ Your business is verified.
          </p>
        ) : vStatus === "pending" ? (
          <p className="mt-4 text-sm font-medium text-[var(--color-ochre-700)]">
            ⏳ Under review — we&apos;ll update your badge once it&apos;s checked.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {vStatus === "rejected" && profile?.businessVerification?.reviewerNote && (
              <p className="text-sm text-[var(--color-brick)]">
                Previous review: {profile.businessVerification.reviewerNote}
              </p>
            )}
            <Input
              label="Company registration (CIPC) number"
              name="regNumber"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
              placeholder="e.g. 2021/123456/07"
            />
            <div>
              <p className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                Proof of registration
              </p>
              <PhotoUploader
                kind="verification"
                scopeId={user.uid}
                accept="image/*,application/pdf"
                label={proofURL ? "Replace document" : "Upload CIPC document"}
                hint="A photo or PDF of your CIPC registration. Private — only the review team sees it."
                initialPreview={proofURL}
                onUploaded={(url) => setProofURL(url)}
              />
            </div>
            {vError && <p className="text-sm text-[var(--color-brick)]">{vError}</p>}
            <Button
              type="button"
              variant="secondary"
              onClick={submitVerification}
              loading={vSubmitting}
              loadingText="Submitting…"
            >
              Submit for verification
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
