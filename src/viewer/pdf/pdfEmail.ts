/**
 * Optionaler E-Mail-Versand: Das Backend schickt einen Download-Link an die Adresse des
 * angemeldeten Kontos, sobald das PDF fertig ist. Ob der Server Mails verschicken kann, steht in
 * GET /api/pdf/limits (mailEnabled).
 */

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
