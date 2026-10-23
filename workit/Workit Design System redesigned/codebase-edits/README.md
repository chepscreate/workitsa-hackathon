# Codebase edits — drop-in replacements for `WorkitEarnit/workit/src/...`

Mirror of the production codebase's structure. Two batches:

## Batch 1 — line-wrap polish (low-risk fixes)

- `src/components/Button.tsx` — `whitespace-nowrap` on base classes
- `src/components/Badge.tsx`  — `whitespace-nowrap` on base classes
- `src/components/Logo.tsx`   — `whitespace-nowrap` on the tagline span
- `src/components/Testimonials.tsx` — figcaption restructure

## Batch 2 — full design upgrades

- `src/app/signin/page.tsx`  — 2-column brand panel + form card layout
- `src/components/HomeDashboard.tsx` — adds active-job strip, 4-up stats
- `src/components/PostJobShell.tsx`  — NEW wrapper component (use in
  `src/app/post-a-job/page.tsx` — see `../DEPLOY.md` for the 5-line edit)
- `src/components/JobDetailLayout.tsx` — NEW wrapper component (use in
  `src/app/jobs/page.tsx` — see `../DEPLOY.md` for the wiring)

See `../DEPLOY.md` for the full guide, rollout order, and `git` commands.

Drop-in for Batch 1 files; the Batch 2 page rewrites are also drop-ins;
the two new wrapper components in Batch 2 (`PostJobShell`, `JobDetailLayout`)
need a 5-minute wiring step in the existing pages — DEPLOY.md walks
through it.

