// Backend-Aufrufe rund um Snapshots: PDF noch abrufbar? Uploads am Leben halten.

export interface PdfInfo {
  fileSize: number;
  createdAt: number;
  expiresAt: number;
}

/** Größe und Ablauf eines gecachten PDFs; null, wenn es schon gelöscht ist (404). */
export async function fetchPdfInfo(progressId: string): Promise<PdfInfo | null> {
  const response = await fetch(`/api/pdf/${encodeURIComponent(progressId)}/info`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return response.json();
}

/** Download-Link mit Dateinamen, der Server liefert das PDF als Anhang. */
export function pdfDownloadUrl(progressId: string, name: string): string {
  return `/api/pdf/${encodeURIComponent(progressId)}?name=${encodeURIComponent(name)}`;
}

/** Dateiname für den Download, z. B. „60-Karten-Lightning-Bolt“. */
export function pdfFileName(label: string): string {
  const cleaned = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 _-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
  return cleaned || 'deck';
}

/**
 * Verlängert die Aufbewahrung eigener Uploads im Backend.
 * Gibt die IDs zurück, die es dort nicht mehr gibt.
 */
export async function touchUploads(ids: string[]): Promise<string[]> {
  const results = await Promise.all(ids.map(async id => {
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(id)}/touch`, { method: 'POST' });
      return response.status === 404 ? id : null;
    } catch {
      // Netzwerkfehler: nicht als gelöscht werten
      return null;
    }
  }));
  return results.filter((id): id is string => id !== null);
}
