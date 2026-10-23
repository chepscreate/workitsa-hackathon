"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Container from "@/components/Container";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import Input from "@/components/Input";
import Textarea from "@/components/Textarea";
import Select from "@/components/Select";
import { doc, getDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { createJob, getJob } from "@/lib/jobs";
import { CATEGORIES, EXPERIENCE_OPTIONS, PAYMENT_OPTIONS, SUBCATEGORIES, TOOLS_OPTIONS, findSubcategoryLabel, type CategoryId, type PaymentMethod } from "@/lib/types";
import { assessPrice, formatRand } from "@/lib/priceGuide";
import PhotoUploader from "@/components/PhotoUploader";
import LocationPicker from "@/components/LocationPicker";
import AccountGate from "@/components/AccountGate";
import PostJobShell, { JobPreviewCard } from "@/components/PostJobShell";
import { deleteTemplate, listTemplates, saveTemplate, type JobTemplate } from "@/lib/templates";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useTranslation } from "@/contexts/LocaleContext";

/**
 * Fair-price guidance under the price field. Shows the typical band for the
 * chosen category, offers a one-tap "use the typical price" when empty, and
 * gently nudges when the entered price is below what usually gets filled.
 */
function PriceGuide({
  category,
  price,
  onUse,
}: {
  category: CategoryId;
  price: number;
  onUse: (v: number) => void;
}) {
  const { t } = useTranslation();
  const { band, verdict } = assessPrice(category, price);
  const catLabel = (CATEGORIES.find((c) => c.id === category)?.label ?? "these").toLowerCase();
  const cls =
    verdict === "low"
      ? "border-[var(--color-ochre-300)] bg-[var(--color-ochre-50)] text-[var(--color-ochre-700)]"
      : verdict === "high" || verdict === "fair"
        ? "border-[var(--color-sage-400)] bg-[var(--color-sage-100)] text-[var(--color-sage-700)]"
        : "border-[var(--color-line)] bg-[var(--color-cream-2)] text-[var(--color-ink-soft)]";

  return (
    <div className={`-mt-3 rounded-lg border px-3 py-2 text-xs leading-relaxed ${cls}`}>
      {verdict === "low" ? (
        <>
          {t("postJob.guide.lowPre", { low: formatRand(band.low), cat: catLabel })}
          <b>{formatRand(band.typical)}</b>
          {t("postJob.guide.lowPost")}
        </>
      ) : verdict === "high" ? (
        <>{t("postJob.guide.high", { cat: catLabel })}</>
      ) : verdict === "fair" ? (
        <>{t("postJob.guide.fair", { cat: catLabel })}</>
      ) : (
        <>
          {t("postJob.guide.range", {
            cat: catLabel,
            low: formatRand(band.low),
            high: formatRand(band.high),
          })}
          <button
            type="button"
            onClick={() => onUse(band.typical)}
            className="ml-2 underline font-medium whitespace-nowrap hover:opacity-80"
          >
            {t("postJob.guide.use", { typical: formatRand(band.typical) })}
          </button>
        </>
      )}
    </div>
  );
}

export default function PostJobPage() {
  return (
    <AccountGate>
      <Suspense fallback={null}>
        <PostJobInner />
      </Suspense>
    </AccountGate>
  );
}

function PostJobInner() {
  const router = useRouter();
  const search = useSearchParams();
  const rebookId = search.get("rebook");
  const inviteUid = search.get("invite");
  const { user, profile, loading } = useAuth();
  const { t } = useTranslation();
  const [invitedWorker, setInvitedWorker] = useState<{ id: string; name: string } | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CategoryId>("home-garden");
  const [subcategory, setSubcategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [suggestedPrice, setSuggestedPrice] = useState<string>("");
  const [workersNeeded, setWorkersNeeded] = useState<string>("1");
  const [suburb, setSuburb] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("Gauteng");
  const [photoURLs, setPhotoURLs] = useState<string[]>([]);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  // Structured specs
  const [toolsProvided, setToolsProvided] = useState<"" | "employer" | "worker" | "shared" | "na">("");
  const [transportIncluded, setTransportIncluded] = useState(false);
  const [trainingProvided, setTrainingProvided] = useState(false);
  const [experienceLevel, setExperienceLevel] = useState<"" | "any" | "some" | "experienced">("");
  const [estimatedHours, setEstimatedHours] = useState<string>("");
  const [estimatedUnit, setEstimatedUnit] = useState<"hours" | "days">("hours");
  const [dueDate, setDueDate] = useState<string>(""); // YYYY-MM-DD from <input type="date">
  const [dueTime, setDueTime] = useState<string>(""); // HH:MM, optional
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [prefGender, setPrefGender] = useState<"any" | "male" | "female">("any");
  const [prefAgeMin, setPrefAgeMin] = useState<string>("");
  const [prefAgeMax, setPrefAgeMax] = useState<string>("");
  const [urgent, setUrgent] = useState(false);
  // While creating: temp scope ID so upload paths get filed somewhere even
  // before the job doc exists. We use a stable random ID for this session.
  const [draftId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `draft-${crypto.randomUUID()}`
      : `draft-${Date.now()}`,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/signin?next=/post-a-job");
  }, [loading, user, router]);

  // --- Job templates (employer's saved briefs) ---
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const confirm = useConfirm();
  useEffect(() => {
    if (!user) return;
    listTemplates(user.uid).then(setTemplates).catch(() => setTemplates([]));
  }, [user]);
  const loadTemplate = (t: JobTemplate) => {
    setTitle(t.title);
    setCategory(t.category);
    setDescription(t.description);
    setSuggestedPrice(String(t.suggestedPrice));
    if (t.suburb) setSuburb(t.suburb);
    if (t.city) setCity(t.city);
    if (t.province) setProvince(t.province);
  };
  const onSaveTemplate = async () => {
    if (!user || !title.trim()) return;
    const ok = await confirm({
      title: t("postJob.tpl.saveTitle"),
      body: t("postJob.tpl.saveBody"),
      confirmLabel: t("postJob.tpl.saveConfirm"),
      tone: "neutral",
    });
    if (!ok) return;
    const id = await saveTemplate(user.uid, {
      name: title.trim().slice(0, 60),
      title: title.trim(),
      description: description.trim(),
      category,
      suggestedPrice: Number(suggestedPrice) || 0,
      suburb: suburb.trim() || undefined,
      city: city.trim() || undefined,
      province,
    });
    setTemplates((t) => [
      { id, name: title.trim().slice(0, 60), title, description, category, suggestedPrice: Number(suggestedPrice) || 0, suburb, city, province, createdAt: Date.now() },
      ...t,
    ]);
  };
  const onDeleteTemplate = async (tpl: JobTemplate) => {
    if (!user) return;
    const ok = await confirm({
      title: t("postJob.tpl.deleteTitle", { name: tpl.name }),
      tone: "danger",
      confirmLabel: t("postJob.tpl.deleteConfirm"),
    });
    if (!ok) return;
    await deleteTemplate(user.uid, tpl.id);
    setTemplates((arr) => arr.filter((x) => x.id !== tpl.id));
  };

  // Invite: when the form is opened from a worker's profile page, fetch their
  // name so we can show "Inviting Sipho" in the banner and write their UID
  // into invitedWorkerIds on submit.
  useEffect(() => {
    if (!inviteUid) return;
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), "users", inviteUid));
        if (!snap.exists()) return;
        const data = snap.data() as { displayName?: string; role?: string };
        if (data.role !== "worker") return;
        setInvitedWorker({ id: inviteUid, name: data.displayName ?? "Worker" });
      } catch {
        /* silent — banner just won't show */
      }
    })();
  }, [inviteUid]);

  // Rebook: pre-fill form from a previous completed job
  const [rebookWorker, setRebookWorker] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    if (!rebookId) return;
    (async () => {
      try {
        const prev = await getJob(rebookId);
        if (!prev) return;
        setTitle(prev.title);
        setCategory(prev.category);
        setDescription(prev.description);
        setSuggestedPrice(String(prev.agreedPrice ?? prev.suggestedPrice));
        setSuburb(prev.suburb);
        setCity(prev.city);
        setProvince(prev.province);
        if (prev.assignedWorkerId && prev.assignedWorkerName) {
          setRebookWorker({ id: prev.assignedWorkerId, name: prev.assignedWorkerName });
        }
      } catch {
        /* ignore */
      }
    })();
  }, [rebookId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!profile) return;
    const price = Number(suggestedPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setError(t("postJob.error.priceInvalid"));
      return;
    }
    const crewSize = Math.max(1, Math.min(20, Math.floor(Number(workersNeeded) || 1)));
    // Combine date + (optional) time into an epoch ms. Empty date → no deadline.
    let dueAtNum: number | undefined;
    if (dueDate) {
      const iso = dueTime ? `${dueDate}T${dueTime}` : `${dueDate}T23:59`;
      const parsed = new Date(iso).getTime();
      if (Number.isFinite(parsed)) dueAtNum = parsed;
    }
    setSubmitting(true);
    try {
      const hoursNum = Number(estimatedHours);
      const id = await createJob({
        employer: profile,
        title,
        description,
        category,
        ...(subcategory ? { subcategory } : {}),
        suggestedPrice: price,
        suburb,
        city,
        province,
        photoURLs,
        ...(pin ? { lat: pin.lat, lng: pin.lng } : {}),
        ...(toolsProvided ? { toolsProvided } : {}),
        transportIncluded,
        trainingProvided,
        ...(experienceLevel ? { experienceLevel } : {}),
        ...(Number.isFinite(hoursNum) && hoursNum > 0
          ? { estimatedHours: hoursNum, estimatedUnit }
          : {}),
        ...(dueAtNum ? { dueAt: dueAtNum } : {}),
        paymentMethod,
        ...(crewSize > 1 ? { workersNeeded: crewSize } : {}),
        ...(invitedWorker ? { invitedWorkerIds: [invitedWorker.id] } : {}),
        ...(() => {
          const ageMin = Number(prefAgeMin);
          const ageMax = Number(prefAgeMax);
          const pref: { gender?: "male" | "female" | "any"; ageMin?: number; ageMax?: number } = {};
          if (prefGender !== "any") pref.gender = prefGender;
          if (Number.isFinite(ageMin) && ageMin > 0) pref.ageMin = ageMin;
          if (Number.isFinite(ageMax) && ageMax > 0) pref.ageMax = ageMax;
          return Object.keys(pref).length > 0 ? { workerPreference: pref } : {};
        })(),
        ...(urgent ? { urgent: true } : {}),
      });
      router.push(`/jobs?id=${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("postJob.error.couldNotPost"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <>
        <Header />
        <main className="flex-1">
          <Container className="py-14"><p className="text-[var(--color-ink-muted)]">{t("common.loading")}</p></Container>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <PostJobShell
      rebookId={rebookId}
      preview={
        <JobPreviewCard
          title={title}
          categoryLabel={CATEGORIES.find((c) => c.id === category)?.label}
          subcategoryLabel={findSubcategoryLabel(category, subcategory)}
          description={description}
          suburb={suburb}
          city={city}
          price={suggestedPrice}
          urgent={urgent}
          employerName={profile?.displayName}
          employerPhotoURL={profile?.photoURL}
        />
      }
    >
      {invitedWorker && (
        <div className="mb-6 -mt-2">
          <Badge tone="ochre">{t("postJob.invite.badge")}</Badge>
          <p className="mt-2 font-display text-2xl text-[var(--color-ink)] tracking-tight">
            Inviting {invitedWorker.name.split(" ")[0]}
          </p>
        </div>
      )}

      {invitedWorker && (
            <div className="mt-4 rounded-xl p-4 bg-[var(--color-ochre-50)] border border-[var(--color-ochre-300)] text-sm text-[var(--color-ink-soft)] flex items-center justify-between gap-3 flex-wrap">
              <span>
                <b className="text-[var(--color-ink)]">{invitedWorker.name}</b>{" "}
                will get a direct notification when this job is posted. The job
                stays public so anyone else can offer too.
              </span>
              <Link
                href="/post-a-job"
                className="text-xs underline text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              >
                {t("postJob.invite.cancel")}
              </Link>
            </div>
          )}

          {/* Saved templates */}
          {templates.length > 0 && !rebookWorker && (
            <div className="mt-6 rounded-xl p-4 bg-[var(--color-cream-2)] border border-[var(--color-line)]">
              <p className="text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold mb-2">
                {t("postJob.templates.title")}
              </p>
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="inline-flex items-center bg-[var(--color-paper)] border border-[var(--color-line)] rounded-pill overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => loadTemplate(t)}
                      className="px-3 py-1.5 text-sm hover:bg-[var(--color-cream-2)]"
                      title={`Load: ${t.name}`}
                    >
                      {t.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTemplate(t)}
                      className="px-2 py-1.5 text-[var(--color-ink-muted)] hover:text-[var(--color-brick)] border-l border-[var(--color-line)]"
                      aria-label={`Delete template ${t.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="mt-3 text-[var(--color-ink-soft)]">
            {rebookWorker ? t("postJob.intro.rebook") : t("postJob.intro.default")}
          </p>

          <div className="mt-8 mb-4 rounded-xl p-4 bg-[var(--color-cream-2)] border border-[var(--color-line)] text-xs text-[var(--color-ink-soft)]">
            <b className="text-[var(--color-ink)]">{t("postJob.notice.label")}</b>
            {t("postJob.notice.body")}
            <Link href="/acceptable-use" className="underline" target="_blank">
              {t("postJob.notice.link")}
            </Link>
            {t("postJob.notice.after")}
          </div>

          <form
            onSubmit={onSubmit}
            className="space-y-5 rounded-2xl p-7 bg-[var(--color-paper)] border border-[var(--color-line)] shadow-soft"
          >
            <Input
              label={t("postJob.field.title")}
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("postJob.field.titlePlaceholder")}
              required
            />

            <div className="grid sm:grid-cols-2 gap-4">
              <Select
                label={t("postJob.field.category")}
                name="category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as CategoryId);
                  setSubcategory("");
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Select>
              <Select
                label={t("postJob.field.subcategory")}
                name="subcategory"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
              >
                <option value="">{t("postJob.field.subcategoryAny")}</option>
                {SUBCATEGORIES[category].map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </Select>
            </div>

            <Textarea
              label={t("postJob.field.description")}
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("postJob.field.descriptionPlaceholder")}
              required
            />

            {/* ---------- JOB SPECS ---------- */}
            <fieldset className="min-w-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-cream-2)] p-4 space-y-4">
              <legend className="px-2 text-xs uppercase tracking-widest text-[var(--color-ink-muted)] font-semibold">
                {t("postJob.details.legend")}
              </legend>

              <div>
                <p className="text-sm font-medium text-[var(--color-ink)] mb-2">{t("postJob.details.tools")}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TOOLS_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setToolsProvided((cur) => (cur === t.id ? "" : t.id))}
                      className={`text-left rounded-lg p-2.5 border text-xs transition-colors ${
                        toolsProvided === t.id
                          ? "border-[var(--color-ochre-500)] bg-[var(--color-ochre-50)] text-[var(--color-ink)]"
                          : "border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink-soft)] hover:border-[var(--color-ochre-300)]"
                      }`}
                    >
                      <span className="block font-medium">{t.label}</span>
                      <span className="block text-[10px] text-[var(--color-ink-muted)] mt-0.5">{t.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-[var(--color-ink)] mb-2">{t("postJob.details.experience")}</p>
                <div className="grid grid-cols-3 gap-2">
                  {EXPERIENCE_OPTIONS.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setExperienceLevel((cur) => (cur === e.id ? "" : e.id))}
                      className={`text-left rounded-lg p-2.5 border text-xs transition-colors ${
                        experienceLevel === e.id
                          ? "border-[var(--color-ochre-500)] bg-[var(--color-ochre-50)] text-[var(--color-ink)]"
                          : "border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink-soft)] hover:border-[var(--color-ochre-300)]"
                      }`}
                    >
                      <span className="block font-medium">{e.label}</span>
                      <span className="block text-[10px] text-[var(--color-ink-muted)] mt-0.5">{e.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="flex items-start gap-3 rounded-lg p-3 border border-[var(--color-line)] bg-[var(--color-paper)] cursor-pointer hover:border-[var(--color-ochre-300)]">
                  <input
                    type="checkbox"
                    checked={transportIncluded}
                    onChange={(e) => setTransportIncluded(e.target.checked)}
                    className="mt-1 accent-[var(--color-ochre-500)] w-4 h-4"
                  />
                  <span className="text-sm">
                    <span className="block font-medium text-[var(--color-ink)]">{t("postJob.details.transport")}</span>
                    <span className="block text-xs text-[var(--color-ink-muted)] mt-0.5">
                      {t("postJob.details.transportHint")}
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg p-3 border border-[var(--color-line)] bg-[var(--color-paper)] cursor-pointer hover:border-[var(--color-ochre-300)]">
                  <input
                    type="checkbox"
                    checked={trainingProvided}
                    onChange={(e) => setTrainingProvided(e.target.checked)}
                    className="mt-1 accent-[var(--color-ochre-500)] w-4 h-4"
                  />
                  <span className="text-sm">
                    <span className="block font-medium text-[var(--color-ink)]">{t("postJob.details.training")}</span>
                    <span className="block text-xs text-[var(--color-ink-muted)] mt-0.5">
                      {t("postJob.details.trainingHint")}
                    </span>
                  </span>
                </label>
              </div>

              <div>
                <p className="text-sm font-medium text-[var(--color-ink)] mb-2">
                  {t("postJob.details.duration")}
                </p>
                <div className="flex gap-2 items-stretch">
                  <input
                    type="number"
                    min={1}
                    step="any"
                    aria-label={t("postJob.details.duration")}
                    name="estimatedHours"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    placeholder={estimatedUnit === "days" ? "e.g. 2" : "e.g. 3"}
                    className="flex-1 min-w-0 px-4 py-3 rounded-md bg-[var(--color-paper)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ochre-300)] text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] text-sm"
                  />
                  <div className="inline-flex flex-shrink-0 p-1 rounded-pill bg-[var(--color-paper)] border border-[var(--color-line)]">
                    <button
                      type="button"
                      onClick={() => setEstimatedUnit("hours")}
                      className={`px-4 rounded-pill text-xs transition-colors ${
                        estimatedUnit === "hours"
                          ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                          : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                      }`}
                    >
                      {t("postJob.details.hours")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEstimatedUnit("days")}
                      className={`px-4 rounded-pill text-xs transition-colors ${
                        estimatedUnit === "days"
                          ? "bg-[var(--color-ink)] text-[var(--color-cream)]"
                          : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
                      }`}
                    >
                      {t("postJob.details.days")}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-ink-muted)] mt-1.5">
                  {estimatedUnit === "days"
                    ? t("postJob.durationHint.week")
                    : t("postJob.durationHint.day")}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-[var(--color-ink)] mb-2">
                  {t("postJob.details.dueBy")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    aria-label={t("postJob.details.dueBy")}
                    name="dueDate"
                    value={dueDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="px-4 py-3 rounded-md bg-[var(--color-paper)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ochre-300)] text-[var(--color-ink)] text-sm"
                  />
                  <input
                    type="time"
                    aria-label={t("postJob.details.dueBy")}
                    name="dueTime"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    disabled={!dueDate}
                    placeholder="Optional"
                    className="px-4 py-3 rounded-md bg-[var(--color-paper)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ochre-300)] text-[var(--color-ink)] text-sm disabled:opacity-50"
                  />
                </div>
                <p className="text-xs text-[var(--color-ink-muted)] mt-1.5">
                  {dueDate
                    ? dueTime
                      ? t("postJob.dueHint.deadline")
                      : `${t("postJob.dueHint.deadline")} ${t("postJob.dueHint.defaultTime")}`
                    : t("postJob.dueHint.none")}
                </p>
                {dueDate && (
                  <button
                    type="button"
                    onClick={() => { setDueDate(""); setDueTime(""); }}
                    className="mt-2 text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-brick)] underline"
                  >
                    {t("postJob.details.clearDeadline")}
                  </button>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-[var(--color-ink)] mb-2">{t("postJob.details.payment")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_OPTIONS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPaymentMethod(p.id)}
                      className={`text-left rounded-lg p-2.5 border text-xs transition-colors ${
                        paymentMethod === p.id
                          ? "border-[var(--color-ochre-500)] bg-[var(--color-ochre-50)] text-[var(--color-ink)]"
                          : "border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink-soft)] hover:border-[var(--color-ochre-300)]"
                      }`}
                    >
                      <span className="block font-medium">{p.label}</span>
                      <span className="block text-[10px] text-[var(--color-ink-muted)] mt-0.5">{p.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred worker — soft preference, not a hard filter */}
              <div>
                <p className="text-sm font-medium text-[var(--color-ink)] mb-2">
                  {t("postJob.details.preferredWorker")}
                </p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {(["any", "female", "male"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setPrefGender(g)}
                      className={`rounded-lg p-2.5 border text-xs capitalize transition-colors ${
                        prefGender === g
                          ? "border-[var(--color-ochre-500)] bg-[var(--color-ochre-50)] text-[var(--color-ink)]"
                          : "border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink-soft)] hover:border-[var(--color-ochre-300)]"
                      }`}
                    >
                      {g === "any" ? t("postJob.details.anyGender") : g}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={16}
                    max={99}
                    value={prefAgeMin}
                    onChange={(e) => setPrefAgeMin(e.target.value)}
                    placeholder={t("postJob.details.minAge")}
                    className="px-4 py-2.5 rounded-md bg-[var(--color-paper)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ochre-300)] text-sm"
                  />
                  <input
                    type="number"
                    min={16}
                    max={99}
                    value={prefAgeMax}
                    onChange={(e) => setPrefAgeMax(e.target.value)}
                    placeholder={t("postJob.details.maxAge")}
                    className="px-4 py-2.5 rounded-md bg-[var(--color-paper)] border border-[var(--color-line)] focus:border-[var(--color-ochre-500)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ochre-300)] text-sm"
                  />
                </div>
                <p className="text-[10px] text-[var(--color-ink-muted)] mt-1.5 leading-relaxed">
                  {t("postJob.prefNote.pre")}
                  <b>{t("postJob.prefNote.bold")}</b>
                  {t("postJob.prefNote.post")}
                </p>
              </div>
            </fieldset>

            <Input
              label={t("postJob.field.price")}
              name="suggestedPrice"
              type="number"
              min={1}
              step="any"
              value={suggestedPrice}
              onChange={(e) => setSuggestedPrice(e.target.value)}
              placeholder={t("postJob.field.pricePlaceholder")}
              hint={
                Number(workersNeeded) > 1
                  ? t("postJob.priceHint.crew", {
                      total: Math.round((Number(suggestedPrice) || 0) * Number(workersNeeded)),
                    })
                  : t("postJob.priceHint.single")
              }
              required
            />

            <PriceGuide
              category={category}
              price={Number(suggestedPrice)}
              onUse={(v) => setSuggestedPrice(String(v))}
            />

            <Input
              label={t("postJob.field.workers")}
              name="workersNeeded"
              type="number"
              min={1}
              max={20}
              step={1}
              value={workersNeeded}
              onChange={(e) => setWorkersNeeded(e.target.value)}
              hint={
                Number(workersNeeded) > 1
                  ? t("postJob.workersHint.crew", { count: workersNeeded })
                  : t("postJob.workersHint.single")
              }
            />

            <div className="grid sm:grid-cols-3 gap-4">
              <Input
                label={t("postJob.field.suburb")}
                name="suburb"
                value={suburb}
                onChange={(e) => setSuburb(e.target.value)}
                placeholder={t("postJob.field.suburbPlaceholder")}
                required
              />
              <Input
                label={t("postJob.field.city")}
                name="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t("postJob.field.cityPlaceholder")}
                required
              />
              <Select
                label={t("postJob.field.province")}
                name="province"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
              >
                <option>Gauteng</option>
                <option disabled>{t("postJob.field.provinceOther")}</option>
              </Select>
            </div>

            <div>
              <LocationPicker
                label={t("postJob.location.label")}
                hint={t("postJob.location.hint")}
                onChange={(c) => setPin({ lat: c.lat, lng: c.lng })}
              />
            </div>

            <div>
              <p className="block text-sm font-medium text-[var(--color-ink)] mb-2">
                {t("postJob.photos.label")}
              </p>
              {photoURLs.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {photoURLs.map((u, i) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={u}
                      src={u}
                      alt={`Job photo ${i + 1}`}
                      className="w-20 h-20 rounded-lg object-cover border border-[var(--color-line)]"
                    />
                  ))}
                </div>
              )}
              <PhotoUploader
                kind="job"
                scopeId={draftId}
                accept="image/*"
                label={t("postJob.photos.add")}
                hint={t("postJob.photos.hint")}
                onUploaded={(url) => setPhotoURLs((arr) => [...arr, url])}
              />
            </div>

            {/* Urgency flag */}
            <label className="flex items-start gap-3 p-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-cream-2)] cursor-pointer hover:border-[var(--color-brick)] transition-colors">
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
                className="mt-1 w-5 h-5 accent-[var(--color-brick)] flex-shrink-0"
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-[var(--color-ink)] flex items-center gap-2">
                  <span aria-hidden>🔥</span> {t("postJob.urgent.label")}
                </span>
                <span className="block text-xs text-[var(--color-ink-muted)] mt-0.5">
                  {t("postJob.urgent.hint")}
                </span>
              </span>
            </label>

            {error && (
              <p className="text-sm text-[var(--color-brick)]">{error}</p>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <button
                type="button"
                onClick={onSaveTemplate}
                disabled={!title.trim() || submitting}
                className="px-5 py-3 rounded-pill border border-[var(--color-line)] text-sm hover:bg-[var(--color-cream-2)] disabled:opacity-50 whitespace-nowrap"
              >
                {t("postJob.action.saveTemplate")}
              </button>
              <Button
                type="submit"
                size="lg"
                variant="primary"
                className="flex-1"
                loading={submitting}
                loadingText={t("postJob.action.posting")}
              >
                {t("postJob.action.post")}
              </Button>
            </div>
          </form>
    </PostJobShell>
  );
}
