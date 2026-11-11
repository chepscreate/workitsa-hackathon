/**
 * South African ID number validation — free, instant, fully local automated
 * first-pass KYC (Layer 1). No external provider needed.
 *
 * A 13-digit SA ID encodes: YYMMDD (date of birth) · SSSS (gender sequence) ·
 * C (citizenship) · A (deprecated) · Z (Luhn check digit). This module:
 *   1. checks the structure + the Luhn check digit (catches typos + random/
 *      fabricated numbers — a wrong digit fails the checksum),
 *   2. extracts DOB / gender / citizenship, and
 *   3. cross-checks the extracted DOB + gender against what the applicant
 *      actually entered — a mismatch is the strongest "this isn't their ID"
 *      fraud signal a structural check can give.
 *
 * It does NOT prove the ID is real in Home Affairs or that the holder is the
 * applicant — that's Layer 2 (Smile ID / DHA + biometric selfie match).
 */

import type { Gender, SaIdCheck } from "./types";

export type { SaIdCheck };

export type SaIdParse = {
  /** Structurally valid: 13 digits, real calendar date, Luhn passes. */
  valid: boolean;
  luhnOk: boolean;
  /** YYYY-MM-DD (century resolved against expectedDob when given, else heuristic). */
  dob?: string;
  gender?: "male" | "female";
  citizenship?: "citizen" | "permanent_resident" | "other";
  /** Human-readable problems, suitable to show a worker or an admin. */
  errors: string[];
};

/** Luhn (mod-10) checksum over the full 13 digits. */
export function luhnValid(digits: string): boolean {
  if (!/^\d{13}$/.test(digits)) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Strip spaces, parse + validate. `expected` enables the cross-checks. */
export function parseSaId(raw: string, expected?: { dob?: string; gender?: Gender }): SaIdParse {
  const id = (raw ?? "").replace(/\s/g, "");
  const errors: string[] = [];

  if (!/^\d{13}$/.test(id)) {
    return { valid: false, luhnOk: false, errors: ["Must be exactly 13 digits."] };
  }

  const luhnOk = luhnValid(id);
  if (!luhnOk) errors.push("Check digit is wrong — likely a typo or not a real ID number.");

  // Date of birth (positions 1–6, YYMMDD).
  const yy = Number(id.slice(0, 2));
  const mm = Number(id.slice(2, 4));
  const dd = Number(id.slice(4, 6));

  let dob: string | undefined;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) {
    errors.push("The date of birth encoded in the ID is invalid.");
  } else {
    // Resolve century: prefer the one matching the entered DOB; else a heuristic.
    const expYear = expected?.dob ? Number(expected.dob.slice(0, 4)) : undefined;
    let year: number;
    if (expYear && expYear % 100 === yy) {
      year = expYear;
    } else {
      const curYY = new Date().getFullYear() % 100;
      year = yy <= curYY ? 2000 + yy : 1900 + yy;
      if (year > new Date().getFullYear()) year -= 100;
    }
    const d = new Date(Date.UTC(year, mm - 1, dd));
    if (d.getUTCFullYear() === year && d.getUTCMonth() === mm - 1 && d.getUTCDate() === dd) {
      dob = `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    } else {
      errors.push("The date of birth encoded in the ID is not a real date.");
    }
  }

  // Gender (positions 7–10): 0000–4999 female, 5000–9999 male.
  const seq = Number(id.slice(6, 10));
  const gender: "male" | "female" = seq >= 5000 ? "male" : "female";

  // Citizenship (position 11): 0 citizen, 1 permanent resident.
  const c = id[10];
  const citizenship: SaIdParse["citizenship"] =
    c === "0" ? "citizen" : c === "1" ? "permanent_resident" : "other";

  const valid = luhnOk && !!dob && errors.length === 0;
  return { valid, luhnOk, dob, gender, citizenship, errors };
}

/** Run the full check + cross-comparison, producing the persistable summary. */
export function checkSaId(raw: string, expected?: { dob?: string; gender?: Gender }): SaIdCheck {
  const p = parseSaId(raw, expected);
  const flags = [...p.errors];

  // Cross-check DOB against the date the applicant gave at signup.
  let dobMatch: boolean | null = null;
  if (expected?.dob && p.dob) {
    dobMatch = expected.dob.slice(5) === p.dob.slice(5) && expected.dob.slice(0, 4) === p.dob.slice(0, 4);
    // Fall back to month/day match if only the year century differs.
    if (!dobMatch) dobMatch = expected.dob.slice(0, 10) === p.dob.slice(0, 10);
    if (!dobMatch) flags.unshift("⚠ ID date of birth doesn't match the date they entered.");
  }

  // Cross-check gender (only when they declared a binary gender).
  let genderMatch: boolean | null = null;
  if (expected?.gender === "male" || expected?.gender === "female") {
    genderMatch = expected.gender === p.gender;
    if (!genderMatch) flags.unshift("⚠ ID gender digit doesn't match the gender they entered.");
  }

  return {
    ran: Date.now(),
    valid: p.valid,
    luhnOk: p.luhnOk,
    dob: p.dob,
    gender: p.gender,
    citizenship: p.citizenship,
    dobMatch,
    genderMatch,
    flags,
  };
}

/** Overall verdict for badge/colour use in the UI. */
export function idCheckVerdict(c?: SaIdCheck): "pass" | "warn" | "fail" | "none" {
  if (!c) return "none";
  if (!c.luhnOk || !c.valid) return "fail";
  if (c.dobMatch === false || c.genderMatch === false) return "warn";
  return "pass";
}
