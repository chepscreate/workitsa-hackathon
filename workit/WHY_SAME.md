# Why some screens still look the same

You said: *"find-work, mobile, dashboard, post-a-job, job-details look the same as my old design."*

Here's the diagnosis for each, and how to fix the ones that should change.

---

## 1. Find-work — looks the same **(expected)**

I never shipped a code change for `/find-work`. My UI kit's "Find work" screen was a **faithful recreation** of yours, not a redesign. If you want it upgraded, I need to design that as a fresh task — ping me.

## 2. Mobile — looks the same **(expected)**

Same story. The UI kit had three phone-frame mockups, but those were stylised previews of the *existing* mobile experience, not new screens to ship. The codebase's mobile experience is just your Next.js pages at narrow widths.

If you want a mobile-specific design pass (richer bottom nav, swipe gestures, sheet UIs, etc.), ping me.

## 3. Dashboard — should look different

`HomeDashboard.tsx` is a full drop-in replacement. Verify it landed:

```bash
grep -n "ActiveJobStrip" src/components/HomeDashboard.tsx
# expect: function ActiveJobStrip(...)
```

If that grep returns nothing, the file didn't get copied over. Re-run:
```bash
cp /path/to/codebase-edits/src/components/HomeDashboard.tsx src/components/
```

If the grep hits, the file's in place — then:

- Hard-refresh (Cmd+Shift+R, or test in incognito).
- Check the Firebase Hosting deploys panel — confirm the latest deploy's commit hash matches your most recent push.
- Note that the **"Active job" strip** only appears when you have a job in `assigned` or `in_progress` status. If you currently have no in-flight jobs, that whole section is hidden — but the **4-up stats grid** should still look different from the old 2-up.

## 4. Post-a-job — wiring IS in place

Confirmed by reading your repo: `post-a-job/page.tsx` already imports `PostJobShell` and `JobPreviewCard` and uses them in the return. So this *is* deployed.

If it still looks like the old single-column form, the most likely cause is **viewport width**. The 2-column layout only kicks in at `lg:` (1024px+). On laptops with sidebars (Vercel preview, devtools open), the effective viewport often sits around 900–1000px and stays single-column.

Test on a wide desktop with no devtools/sidebar open. You should see:
- "← Back to dashboard" link at top
- "Post a job." big serif H1
- Lead paragraph
- Two columns: form on the left, live-preview card on the right

If you don't see those, hard-refresh or check the deploy timestamp.

## 5. Job-details — half-wired, needs one more edit

Your `jobs/page.tsx` imports `JobDetailLayout` and passes the job in — but:

- **`priceAction={null}`** — the sticky right card has an empty action slot.
- **The old title + price block was left inside the left column**, so the price appears twice on lg+ viewports (once in the body, once in the right card).

### Two-minute fix

In `src/app/jobs/page.tsx`, in the `JobDetailInner` return (~line 197–225), you currently have:

```tsx
<div className="mt-4 flex items-start justify-between gap-4 flex-wrap">
  <div>
    <div className="flex items-center gap-2 flex-wrap">
      <Badge tone="ochre">{categoryLabel(job.category)}</Badge>
      <StatusBadge status={job.status} />
      {isCrewJob(job) && (
        <Badge tone="sage">Crew · {filled}/{needed} hired</Badge>
      )}
    </div>
    <h1 className="mt-3 font-display text-4xl sm:text-5xl tracking-tight">
      {job.title}
    </h1>
    <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
      {job.suburb}, {job.city}, {job.province} · Posted by {job.employerName}
    </p>
  </div>
  <div className="text-right">
    <p className="text-xs text-[var(--color-ink-muted)]">Suggested</p>
    <p className="font-display text-4xl text-[var(--color-ochre-600)]">
      R {job.suggestedPrice}
    </p>
    {job.agreedPrice && (
      <p className="mt-1 text-xs text-[var(--color-sage-700)]">
        Agreed: R {job.agreedPrice}
      </p>
    )}
  </div>
</div>
```

**Replace that whole block with:**

```tsx
<div>
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
    {job.suburb}, {job.city}, {job.province} · Posted by {job.employerName}
  </p>
  {job.agreedPrice && (
    <p className="mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-pill text-xs font-medium border bg-[var(--color-sage-100)] text-[var(--color-sage-700)] border-[var(--color-sage-400)]">
      Agreed: R {job.agreedPrice}
    </p>
  )}
</div>
```

The right-aligned price block goes — `JobDetailLayout` shows the price in the sticky right column at lg+. On mobile (< lg) the right column stacks below the title, so the price is still visible just after the header.

**Replace the JobDetailLayout opening tag**:

```tsx
<JobDetailLayout
  job={job}
  employer={{
    name: job.employerName,
    photoURL: job.employerPhotoURL,
  }}
  priceAction={null}     /* ← change this line */
>
```

To:

```tsx
<JobDetailLayout
  job={job}
  employer={{
    name: job.employerName,
    photoURL: job.employerPhotoURL,
  }}
>
```

(Drop the `priceAction` prop entirely now that it's optional in the new `JobDetailLayout.tsx`. Re-download the patch — I updated the component to handle the omitted/null case cleanly.)

The OfferForm / EmployerControls / WorkerLifecycle UIs that drive offer acceptance and job-state transitions stay where they are inside the left column — they're too complex (and viewer-role-dependent) to flatten into a single sticky CTA.

---

## Diagnostic checklist if something STILL looks the same

1. **Re-pull the patch download** — I updated `JobDetailLayout.tsx` to make `priceAction` optional. Old version will TypeScript-error if you drop the prop.
2. **Verify each file landed** in your repo:
   ```bash
   git diff src/app/signin/page.tsx
   git diff src/components/HomeDashboard.tsx
   git diff src/components/Button.tsx src/components/Badge.tsx
   ```
   Each should show meaningful changes vs. main.
3. **Watch viewport**. The new layouts make their value clear at **≥1024px (`lg:`)**. Below that they intentionally stack — which means on mobile they will look close to the previous single-column layout, just with the title/lead reorganised.
4. **Hard-refresh.** Browser caches Next.js chunks aggressively.
5. **Check deploy log.** Firebase Hosting console → latest deploy → confirm the commit hash.

Ping with a screenshot + the page URL if something still looks identical at desktop width after the above, and I'll dig in.
