# Deploy guide — applying design upgrades to the Workit codebase

Two batches of edits, both in `codebase-edits/` (same path structure as
your codebase — drop in, commit, push).

## Batch 1 — line-wrap polish fixes

Tiny, low-risk, no behavior change. Apply first.

```
codebase-edits/src/components/
├── Button.tsx        # +whitespace-nowrap on base classes
├── Badge.tsx         # +whitespace-nowrap on base classes
├── Logo.tsx          # +whitespace-nowrap on the tagline
└── Testimonials.tsx  # restructured figcaption — job tag stacks under role
```

## Batch 2 — full design upgrades for the screens I built in the UI kit

```
codebase-edits/src/app/signin/
└── page.tsx                   # 2-column layout (brand panel + form card)

codebase-edits/src/components/
├── HomeDashboard.tsx          # adds "active job" strip + 4-up stats
├── PostJobShell.tsx           # NEW — wrap your existing post-a-job form
│                              #       to get live-preview 2-col layout
└── JobDetailLayout.tsx        # NEW — sticky 2-col layout for the jobs
                               #       detail page (job left, action/employer/safety right)
```

### Why split into batch 1 and batch 2?

Batch 1 is bug-fix-grade: small CSS additions, every file is a full
drop-in replacement. Batch 2 has real visual changes — you may want to
A/B them before shipping, or roll them out screen by screen.

---

## How to apply

From the root of your `workit/` directory:

```bash
# Drop everything in
cp -r /path/to/design-system/codebase-edits/src/* src/
```

Then run locally:

```bash
npm run dev
# open http://localhost:3000/signin   ← new 2-col layout
# sign in → new dashboard layout
# open a job → wrap with JobDetailLayout (see "Wiring step" below)
# /post-a-job → wrap with PostJobShell
```

### Wiring step — for `PostJobShell` and `JobDetailLayout`

These two are **NEW components**, not page replacements. Your current
`post-a-job/page.tsx` (702 lines) and `jobs/page.tsx` (1571 lines) have
too much Firebase + state machinery to swap whole-hog without risk.
Instead, the new components are **visual shells you wrap around your
existing render output**.

**PostJobShell** — open `src/app/post-a-job/page.tsx` and find your
top-level return (the one that renders `<Header />` and the form). Replace
the `<Header>…<Footer />` outer JSX with:

```tsx
import PostJobShell, { JobPreviewCard } from "@/components/PostJobShell";

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
    {/* keep ALL your existing <Input>, <Textarea>, <Select>, <PhotoUploader>,
        <LocationPicker>, <Button> etc — paste them as children here */}
  </PostJobShell>
);
```

The shell takes care of Header/Footer/Container/title/back-link and the
sticky preview column.

**JobDetailLayout** — open `src/app/jobs/page.tsx`, find the
`JobDetailInner` return. Wrap its existing body with:

```tsx
import JobDetailLayout, {
  JobDetailHeader,
  JobDetailPhotos,
  JobDetailDescription,
  JobDetailSpecs,
} from "@/components/JobDetailLayout";

return (
  <Container className="py-10 lg:py-14">
    <JobDetailLayout
      job={job}
      employer={{
        name: job.employerName,
        photoURL: job.employerPhotoURL,
        rating: undefined,         // fetch from employer profile if you have it
        jobsPosted: undefined,
        joined: undefined,
      }}
      priceAction={
        /* your existing <Button>Accept</Button> / counter-offer JSX */
      }
    >
      <JobDetailHeader job={job} postedRelative={"23 min ago"} />
      <JobDetailPhotos urls={job.photoURLs} />
      <JobDetailDescription job={job} />
      <JobDetailSpecs job={job} />
      {/* keep ALL your existing offers list, chat (<JobMessages />),
          rating UI, dispute / emergency / confetti JSX — paste them
          as more children here, after the specs */}
    </JobDetailLayout>
  </Container>
);
```

Helper sub-components (`JobDetailHeader`, `JobDetailPhotos`,
`JobDetailDescription`, `JobDetailSpecs`) cover the static parts. The
dynamic parts (offers list, live tracking, dispute UI) stay as-is in
your code — just paste them in as children below `JobDetailSpecs`.

---

## Ship it

```bash
git add src/app/signin src/components/{Button,Badge,Logo,Testimonials,HomeDashboard,PostJobShell,JobDetailLayout}.tsx
git commit -m "design: upgraded sign-in, dashboard, post-a-job, job-detail layouts"
git push
```

Firebase auto-deploys on push (per your `.firebaserc`) — or manually:

```bash
npm run build
firebase deploy --only hosting
```

---

## Rollout order (recommended)

1. **Batch 1** — bug-fix polish, ship immediately.
2. **`signin/page.tsx`** — easy swap, no wiring needed, ship next.
3. **`HomeDashboard.tsx`** — drop in; the new "active job" strip uses
   the same data subscriptions as before, so it just works.
4. **`PostJobShell`** — wire it in when you're ready to spend 20 min in
   `post-a-job/page.tsx` swapping the outer wrapper.
5. **`JobDetailLayout`** — last, since `jobs/page.tsx` is the most
   complex file. Wire it in during a quiet day.

Every step is independent. Anything that doesn't ship still leaves the
rest of the design unbroken.

---

## What I did NOT change

- `src/lib/jobs.ts`, `src/lib/types.ts`, Firestore rules, indexes — no
  data shape changes.
- `PhoneAuthForm.tsx`, `JobMessages.tsx`, `LiveMap.tsx`, `HeatMap.tsx`
  — internals untouched.
- `find-work/page.tsx` — feed already looked good; no upgrade needed.
- `signup/page.tsx` — same auth chrome as `signin/page.tsx`; if you
  want it to match, copy the 2-col layout from the new sign-in page
  (mostly s/Sign in/Create account/).
- `verification/page.tsx`, `profile/page.tsx`, `account/page.tsx` —
  out of scope for this round. Ping if you want them upgraded too.
