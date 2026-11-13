/** Matches the Flutter client: a Tunisian number is stored as 216XXXXXXXX. */
export function normalizeTunisianPhoneDigits(value: string): string | null {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length === 8) return digits;
  if (digits.length === 11 && digits.startsWith("216")) return digits.slice(3);
  return null;
}

/**
 * Input mask for the +216 field: keeps digits only, drops an international
 * prefix pasted with the number, and never exceeds the 8 national digits.
 */
export function sanitizeTunisianPhoneInput(value: string): string {
  let digits = value.replace(/[^0-9]/g, "");
  if (digits.length > 8) {
    if (digits.startsWith("00216")) digits = digits.slice(5);
    else if (digits.startsWith("216")) digits = digits.slice(3);
  }
  return digits.slice(0, 8);
}

/** Supabase Auth expects E.164. */
export function toE164(digits: string): string {
  return `+216${digits}`;
}

/** `profiles.phone` and the reset functions use the canonical form. */
export function toCanonicalPhone(digits: string): string {
  return `216${digits}`;
}

export function formatTunisianPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = normalizeTunisianPhoneDigits(phone);
  if (!digits) return phone;
  return `+216 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
}
