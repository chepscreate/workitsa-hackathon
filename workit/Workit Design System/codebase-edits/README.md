# Codebase edits — drop-in replacements for `WorkitEarnit/workit/src/...`

Mirror of the production codebase's component files, with the design-fix
patches applied. Same path structure — `cp -r codebase-edits/src/* src/`
from the workit root will land them correctly.

See `../DEPLOY.md` for the full guide.

## Files

- `src/components/Button.tsx` — `whitespace-nowrap` on base classes
- `src/components/Badge.tsx`  — `whitespace-nowrap` on base classes
- `src/components/Logo.tsx`   — `whitespace-nowrap` on the tagline span
- `src/components/Testimonials.tsx` — figcaption restructure (job tag
  stacks under role + area; name truncates; avatar gets `flex-shrink-0`)

Each file is the complete updated source, not a diff. Look for the
multi-line code comments explaining what changed and why.
