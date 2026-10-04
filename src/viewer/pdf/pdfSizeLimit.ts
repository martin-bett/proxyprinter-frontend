import { CropSettings, ImageInfo } from '../../service/ApiFactory';
import { PdfSettings } from './SettingsDialog';

/**
 * Obergrenze für die PDF-Größe. Die eigentliche Grenze kommt aus dem Backend
 * (pdf.max-size-mb in application.properties, GET /api/pdf/limits); dieser Wert
 * gilt nur, solange das Backend nicht geantwortet hat.
 */
export const DEFAULT_MAX_PDF_SIZE_MB = 300;

/**
 * Das Backend skaliert jede Karte auf höchstens maxDpi und bettet sie als PNG ein,
 * jede Kopie einzeln. Die Größe hängt daher an den Pixeln, nicht an der Quelldatei
 * (ein 200-KB-JPEG wird schnell ein 1,2-MB-PNG). PNG von Kartenscans liegt grob
 * bei 1,5 bis 2 Byte pro Pixel.
 */
export const PNG_BYTES_PER_PIXEL = 1.6;

const MB = 1024 * 1024;

export interface PdfImageEntry {
  imageUrl: string;
  cropSettings?: CropSettings;
  imageInfo?: ImageInfo;
}

/** Geschätzte Bytes einer Karte im PDF, nach Zuschnitt und DPI-Begrenzung wie im Backend. */
export const estimateCardBytes = (entry: PdfImageEntry, settings: PdfSettings): number => {
  const maxDpi = settings.maxDpi || 300;
  const maxW = Math.floor((settings.width * maxDpi) / 25.4);
  const maxH = Math.floor((settings.height * maxDpi) / 25.4);

  const crop = entry.cropSettings;
  let w = (crop?.width && crop.width > 0 ? crop.width : entry.imageInfo?.width) || 0;
  let h = (crop?.height && crop.height > 0 ? crop.height : entry.imageInfo?.height) || 0;

  // Bild noch nicht geladen: mit der größten Auflösung rechnen, die das Backend erzeugt
  if (w <= 0 || h <= 0) {
    w = maxW;
    h = maxH;
  } else if (w > maxW || h > maxH) {
    const scale = Math.min(maxW / w, maxH / h);
    w *= scale;
    h *= scale;
  }
  return w * h * PNG_BYTES_PER_PIXEL;
};

export const estimatePdfBytes = (entries: PdfImageEntry[], settings: PdfSettings): number =>
  entries.reduce((sum, entry) => sum + estimateCardBytes(entry, settings), 0);

export const bytesToMb = (bytes: number): number => bytes / MB;

export const formatMb = (bytes: number): string => `${Math.round(bytesToMb(bytes))} MB`;

/** Liest die Grenze aus dem Backend (0 = keine Grenze), fällt bei Fehlern auf den Standardwert zurück. */
export const fetchPdfSizeLimitMb = async (): Promise<number> => {
  try {
    const response = await fetch('/api/pdf/limits');
    if (!response.ok) return DEFAULT_MAX_PDF_SIZE_MB;
    const data = await response.json();
    const value = Number(data?.maxSizeMb);
    if (!Number.isFinite(value)) return DEFAULT_MAX_PDF_SIZE_MB;
    return value > 0 ? value : Infinity;
  } catch {
    return DEFAULT_MAX_PDF_SIZE_MB;
  }
};
