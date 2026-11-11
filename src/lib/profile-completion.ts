import type { UserProfile } from "./types";

/**
 * Returns 0–100 representing how complete a profile is.
 * Different fields matter for workers vs employers.
 */
export function profileCompletionPct(profile: UserProfile): number {
  if (!profile) return 0;

  const baseChecks: Array<boolean> = [
    !!profile.displayName,
    !!profile.photoURL,
    !!profile.phone,
    !!profile.bio,
    !!profile.dateOfBirth,
    typeof profile.homeLat === "number" && typeof profile.homeLng === "number",
  ];

  const workerChecks: Array<boolean> = [
    !!profile.verification?.idNumber,
    !!profile.verification?.idPhotoURL,
    !!profile.verification?.selfieVideoURL,
    !!profile.verification?.addressLine,
    !!profile.verification?.addressProofURL,
    !!profile.verification?.skillsSummary,
    Array.isArray(profile.categories) && profile.categories.length > 0,
  ];

  const checks = profile.role === "worker" ? [...baseChecks, ...workerChecks] : baseChecks;
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}
