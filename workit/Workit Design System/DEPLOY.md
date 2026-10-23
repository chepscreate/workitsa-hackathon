# Deploy guide — applying design fixes to the Workit codebase

The fixes from the UI-kit iteration that are **production-relevant** have
been mirrored into `codebase-edits/`, with the same path structure as the
codebase, so you can drop them in directly.

I cannot push, deploy, or run git from inside this design-system
project — the codebase you attached (`WorkitEarnit/`) is read-only, and
there's no shell access on my end. You drive the deploy.

---

## What's in `codebase-edits/`

```
codebase-edits/src/components/
├── Button.tsx        # +whitespace-nowrap on base classes
├── Badge.tsx         # +whitespace-nowrap on base classes
├── Logo.tsx          # +whitespace-nowrap on the "Work it · Earn it" tagline
└── Testimonials.tsx  # restructured figcaption — job tag stacks under role
```

Every file is the **complete updated content** — drop-in replacement, not
a diff. Each fix is annotated with a code comment explaining why.

## Why these four

The full list of flaws I found in the UI kit:

| # | Flaw | Codebase change needed? |
| --- | --- | --- |
| 1 | Buttons wrap mid-word ("Sign in", "Post a job →") | **Yes** — `Button.tsx` |
| 2 | Badges wrap mid-word ("All categories", "Skilled trades") | **Yes** — `Badge.tsx` |
| 3 | Footer eyebrow "WORK IT · EARN IT" wraps | **Yes** — `Logo.tsx` |
| 4 | Testimonial name+role squashed by right-aligned job tag | **Yes** — `Testimonials.tsx` |
| 5 | Header nav vanished at 960px viewports | No — codebase uses Tailwind `md:` (768px) which is fine |
| 6 | Hero card "2.1 km away" overflows on narrow widths | Optional — see below |
| 7 | Save-heart button overlapping JobCard badges | No — codebase already has `pr-12` (48px) on the badges row in `JobCard.tsx` line 56; my UI kit had pr-44 which I fixed locally |
| 8 | Phone-header logo/title collision | No — UI-kit-only (`MobileShellScreen.jsx`); the real `MobileBottomNav.tsx` doesn't have a title |
| 9 | Active job card meta line wrapping | No — UI-kit-only (codebase splits this differently) |

### Optional: hero card meta lines

In `src/app/page.tsx`, the rotated hero stack has two short meta lines
that *could* wrap on very narrow viewports. They're inside a flex parent
that does `justify-between` so they almost never overflow, but if you
want belt-and-braces:

```tsx
// page.tsx ~ line 158, line 178, line 191 — the "2.1 km away", "Sipho M.",
// "Verified · Gold badge" spans
<span className="text-xs text-[var(--color-ink-muted)] whitespace-nowrap">
  2.1 km away
</span>
```

Skip this if you've never seen it wrap at your real-world widths.

---

## How to apply

From the root of your `workit/` directory:

```bash
# Option A — straight copy (the structure mirrors yours)
cp -r /path/to/design-system/codebase-edits/src/* src/

# Option B — review each file first
diff -u src/components/Button.tsx        /path/to/design-system/codebase-edits/src/components/Button.tsx
diff -u src/components/Badge.tsx         /path/to/design-system/codebase-edits/src/components/Badge.tsx
diff -u src/components/Logo.tsx          /path/to/design-system/codebase-edits/src/components/Logo.tsx
diff -u src/components/Testimonials.tsx  /path/to/design-system/codebase-edits/src/components/Testimonials.tsx
```

Then verify locally:

```bash
npm run dev
# open http://localhost:3000 — narrow the window to ~720px and confirm
# nothing wraps mid-word that shouldn't.
```

And ship:

```bash
git add src/components/{Button,Badge,Logo,Testimonials}.tsx
git commit -m "ui: nowrap fixes for buttons, badges, logo tagline; restructure testimonial figcaption"
git push
```

Firebase auto-deploys on push (per your `.firebaserc`) or, if you deploy
manually:

```bash
npm run build
firebase deploy --only hosting
```

---

## What's safe to skip

These changes are purely additive and CSS-only — no behavior changes, no
type changes, no new dependencies. They are very low risk.

If for some reason a deploy is blocking, you can also ship them one file
at a time — they're independent.

---

## What I did NOT change

To stay scoped, I left these alone — flag if you want them too:

- **The Tailwind v4 `globals.css` tokens.** They're already correct; the
  design-system `colors_and_type.css` is just a portable mirror.
- **The Header collapse breakpoint.** Codebase uses `md:` (768px) which
  is already conservative; my 720px choice was UI-kit-specific.
- **`HomeDashboard.tsx`** — has its own "→" links (`Finish verification →`,
  `See all →`) but they're inside `<Link>` tags, not `Button`. They
  won't wrap on the real layout because the parent has `flex-wrap:
  wrap` and the link sits alone in its cell. Add `whitespace-nowrap`
  if it ever bites you.
- **`JobCard.tsx`** — the badge row already has `pr-12` so the heart
  doesn't overlap. My UI-kit version had a smaller padding, fixed
  separately.
