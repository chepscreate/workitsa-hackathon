/**
 * Sign-up source attribution.
 *
 * Growth links carry a `?src=` tag (e.g. the Facebook unemployment-group posts
 * use `https://workitsa.co.za/?src=fb`). The tag usually lands on the HOME page,
 * long before the person reaches /signup, so we capture it on first touch and
 * keep it in localStorage until an account is actually created — then stamp it
 * onto the user profile as `signupSource` and clear it.
 *
 * First-touch wins: if a tag is already stored we don't overwrite it, so the
 * channel that originally brought them gets the credit.
 */

const KEY = "wk_signup_src";

/** Sanitise to a short, safe channel slug. `fb`, `radio`, `fb-alberton`, … */
function clean(v: string | null): string | undefined {
  if (!v) return undefined;
  const s = v.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return s || undefined;
}

/**
 * Read `?src=` (falling back to `utm_source`) from the current URL and store it
 * first-touch. Safe to call on every page load; no-ops without a tag or storage.
 */
export function captureSignupSource(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const src = clean(params.get("src") ?? params.get("utm_source"));
    if (!src) return;
    if (!window.localStorage.getItem(KEY)) window.localStorage.setItem(KEY, src);
  } catch {
    /* private mode / blocked storage — attribution is best-effort */
  }
}

/** The stored sign-up source, if any. */
export function getSignupSource(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage.getItem(KEY) || undefined;
  } catch {
    return undefined;
  }
}

/** Clear the stored source once it's been written to a profile. */
export function clearSignupSource(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
