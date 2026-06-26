// Validation / normalisation des numéros de téléphone (saisis avec un indicatif
// pays séparé, ex. "+33" + "6 12 34 56 78").

// Nombre max de chiffres pour un numéro national (format FR : 10, ex. 06 12 34 56 78).
export const MAX_PHONE_DIGITS = 10;

/** Ne garde que les chiffres. */
export function phoneDigits(s: string): string {
  return (s || "").replace(/\D/g, "");
}

/**
 * Masque de saisie : coupe au-delà de MAX_PHONE_DIGITS chiffres et insère un
 * espace tous les 2 chiffres. "0612345678" -> "06 12 34 56 78".
 */
export function formatPhone(s: string): string {
  return phoneDigits(s)
    .slice(0, MAX_PHONE_DIGITS)
    .replace(/(\d{2})(?=\d)/g, "$1 ");
}

/** Numéro national plausible : 6 à MAX_PHONE_DIGITS chiffres. */
export function isValidPhone(national: string): boolean {
  const len = phoneDigits(national).length;
  return len >= 6 && len <= MAX_PHONE_DIGITS;
}

/** Numéro complet pour un lien wa.me : indicatif + national sans 0 initial. */
export function waNumber(countryCode: string, national: string): string {
  return phoneDigits(countryCode) + phoneDigits(national).replace(/^0+/, "");
}
