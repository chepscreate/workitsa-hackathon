/**
 * Normalise a user-typed South African phone number to E.164 (+27…).
 * Accepts: 082 123 4567, 0821234567, 27821234567, +27821234567, etc.
 * Returns null if the input doesn't look like a valid SA mobile number.
 */
export function normaliseSaPhone(input: string): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  if (!digits) return null;

  let e164: string | null = null;

  // 10-digit local form starting with 0 (e.g. 0821234567)
  if (digits.length === 10 && digits.startsWith("0")) {
    e164 = "+27" + digits.slice(1);
  }
  // 11-digit international without + (27821234567)
  else if (digits.length === 11 && digits.startsWith("27")) {
    e164 = "+" + digits;
  }
  // Already E.164 (+27821234567 → digits == "27821234567")
  else if (input.startsWith("+") && digits.length === 11 && digits.startsWith("27")) {
    e164 = "+" + digits;
  }

  if (!e164) return null;

  // SA mobile prefixes are mostly 6x, 7x, 8x — checks the digit after +27.
  // (We allow 6/7/8 to be permissive; landlines starting with 1 are rejected.)
  const firstMobile = e164.charAt(3);
  if (!["6", "7", "8"].includes(firstMobile)) return null;

  return e164;
}

/** Pretty-print an E.164 SA number for display: +27 82 123 4567 */
export function formatSaPhone(e164: string): string {
  if (!e164.startsWith("+27") || e164.length !== 12) return e164;
  return `+27 ${e164.slice(3, 5)} ${e164.slice(5, 8)} ${e164.slice(8)}`;
}
