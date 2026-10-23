/**
 * Pure-logic unit tests for the SA ID validator (KYC Layer 1).
 *
 * No emulator needed — this targets src/lib/saId.ts directly. Run on its own:
 *   npx vitest run tests/unit/saId.test.ts
 * (The default `npm run test:rules` wraps the whole suite in the Firestore
 * emulator; this file connects to nothing, so it also passes there.)
 */
import { describe, expect, it } from "vitest";
import { luhnValid, parseSaId, checkSaId, idCheckVerdict } from "../../src/lib/saId";

/** Append the Luhn check digit so the resulting 13-digit string is valid. */
function withCheckDigit(first12: string): string {
  if (!/^\d{12}$/.test(first12)) throw new Error("need 12 digits");
  for (let d = 0; d < 10; d++) {
    const candidate = first12 + d;
    if (luhnValid(candidate)) return candidate;
  }
  throw new Error("unreachable: some check digit always works");
}

// Male, citizen, born 1990-01-01: 900101 (DOB) 5000 (male seq) 0 (citizen) 8 (A)
const MALE_1990 = withCheckDigit("900101500008");
// Female, citizen, born 1985-06-15: 850615 2500 (female seq) 0 8
const FEMALE_1985 = withCheckDigit("850615250008");
// Permanent resident, male, born 1979-12-31: 791231 5000 1 8
const PR_1979 = withCheckDigit("791231500018");

describe("luhnValid", () => {
  it("accepts a correctly-constructed number", () => {
    expect(luhnValid(MALE_1990)).toBe(true);
  });
  it("rejects a number with a flipped check digit", () => {
    const bad = MALE_1990.slice(0, 12) + ((Number(MALE_1990[12]) + 1) % 10);
    expect(luhnValid(bad)).toBe(false);
  });
  it("rejects non-13-digit input", () => {
    expect(luhnValid("123")).toBe(false);
    expect(luhnValid("90010150000812")).toBe(false); // 14 chars
    expect(luhnValid("90010150000a")).toBe(false);
  });
});

describe("parseSaId", () => {
  it("extracts DOB, gender, citizenship for a valid male citizen", () => {
    const p = parseSaId(MALE_1990, { dob: "1990-01-01", gender: "male" });
    expect(p.valid).toBe(true);
    expect(p.luhnOk).toBe(true);
    expect(p.dob).toBe("1990-01-01");
    expect(p.gender).toBe("male");
    expect(p.citizenship).toBe("citizen");
    expect(p.errors).toEqual([]);
  });

  it("reads the female gender sequence", () => {
    const p = parseSaId(FEMALE_1985, { dob: "1985-06-15" });
    expect(p.gender).toBe("female");
    expect(p.dob).toBe("1985-06-15");
    expect(p.valid).toBe(true);
  });

  it("reads permanent-resident citizenship", () => {
    const p = parseSaId(PR_1979, { dob: "1979-12-31" });
    expect(p.citizenship).toBe("permanent_resident");
    expect(p.gender).toBe("male");
  });

  it("tolerates spaces in the input", () => {
    const spaced = MALE_1990.replace(/(.{4})/g, "$1 ").trim();
    const p = parseSaId(spaced, { dob: "1990-01-01" });
    expect(p.valid).toBe(true);
  });

  it("flags a wrong check digit", () => {
    const bad = MALE_1990.slice(0, 12) + ((Number(MALE_1990[12]) + 1) % 10);
    const p = parseSaId(bad);
    expect(p.luhnOk).toBe(false);
    expect(p.valid).toBe(false);
    expect(p.errors.join(" ")).toMatch(/check digit/i);
  });

  it("rejects a non-13-digit string", () => {
    const p = parseSaId("12345");
    expect(p.valid).toBe(false);
    expect(p.errors.join(" ")).toMatch(/13 digits/i);
  });

  it("flags an impossible month", () => {
    // 901301 -> month 13. Build with a valid check digit so only the date is wrong.
    const id = withCheckDigit("901301500008");
    const p = parseSaId(id);
    expect(p.dob).toBeUndefined();
    expect(p.errors.join(" ")).toMatch(/date of birth/i);
    expect(p.valid).toBe(false);
  });

  it("resolves the century using the expected DOB year", () => {
    // YY=05 is ambiguous (1905 vs 2005). With expected 2005, it should pick 2005.
    const id = withCheckDigit("050101500008");
    const p = parseSaId(id, { dob: "2005-01-01" });
    expect(p.dob).toBe("2005-01-01");
  });
});

describe("checkSaId cross-checks", () => {
  it("passes when DOB and gender both match", () => {
    const c = checkSaId(MALE_1990, { dob: "1990-01-01", gender: "male" });
    expect(c.dobMatch).toBe(true);
    expect(c.genderMatch).toBe(true);
    expect(c.flags).toEqual([]);
    expect(idCheckVerdict(c)).toBe("pass");
  });

  it("warns on a gender mismatch", () => {
    const c = checkSaId(MALE_1990, { dob: "1990-01-01", gender: "female" });
    expect(c.genderMatch).toBe(false);
    expect(c.flags.join(" ")).toMatch(/gender/i);
    expect(idCheckVerdict(c)).toBe("warn");
  });

  it("warns on a DOB mismatch", () => {
    const c = checkSaId(MALE_1990, { dob: "1992-03-03", gender: "male" });
    expect(c.dobMatch).toBe(false);
    expect(c.flags.join(" ")).toMatch(/date of birth/i);
    expect(idCheckVerdict(c)).toBe("warn");
  });

  it("fails (not warns) when the check digit is wrong, regardless of cross-checks", () => {
    const bad = MALE_1990.slice(0, 12) + ((Number(MALE_1990[12]) + 1) % 10);
    const c = checkSaId(bad, { dob: "1990-01-01", gender: "male" });
    expect(c.luhnOk).toBe(false);
    expect(idCheckVerdict(c)).toBe("fail");
  });

  it("leaves cross-checks null when nothing was provided to compare against", () => {
    const c = checkSaId(MALE_1990);
    expect(c.dobMatch).toBeNull();
    expect(c.genderMatch).toBeNull();
    expect(idCheckVerdict(c)).toBe("pass");
  });
});

describe("idCheckVerdict", () => {
  it("returns 'none' for undefined", () => {
    expect(idCheckVerdict(undefined)).toBe("none");
  });
});
