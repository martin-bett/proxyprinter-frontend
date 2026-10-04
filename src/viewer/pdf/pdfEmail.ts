/**
 * Optionaler E-Mail-Versand: Das Backend schickt einen Download-Link an die Adresse,
 * sobald das PDF fertig ist. Ob der Server Mails verschicken kann, steht in
 * GET /api/pdf/limits (mailEnabled).
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

/** Leer ist erlaubt (kein Versand), sonst dieselbe Prüfung wie im Backend. */
export const isValidOptionalEmail = (value: string): boolean => {
  const email = value.trim();
  return email === '' || (email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email));
};

export const fetchPdfMailEnabled = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/pdf/limits');
    if (!response.ok) return false;
    const data = await response.json();
    return data?.mailEnabled === true;
  } catch {
    return false;
  }
};
