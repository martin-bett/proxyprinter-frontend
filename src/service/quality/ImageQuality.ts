// Schätzt, wie scharf eine Karte gedruckt wird und ob der Kartentext lesbar ist.
//
// Zwei Werte:
//  - effectiveDpi: Pixel pro Zoll, wenn der (gecroppte) Bildausschnitt auf 63 mm Kartenbreite gedruckt wird.
//  - sharpness:    Kantenschärfe im Textfeld, gemessen nachdem das Textfeld auf Druckauflösung (300 DPI)
//                  skaliert wurde. Kleine/hochskalierte, weichgezeichnete oder stark komprimierte Bilder
//                  haben breite, weiche Buchstabenkanten und damit einen niedrigen Wert.
//
// Kantenschärfe = Summe |Laplace| / Summe |Gradient| über Kantenpixel. Für eine Kante mit Unschärfe sigma
// ist die Gradientensumme ~ Kontrast (unabhängig von sigma), die Laplace-Summe ~ Kontrast / sigma.
// Der Quotient hängt also hauptsächlich von der Kantenbreite ab, kaum davon, wie viel Text im Feld steht.

export const CARD_WIDTH_MM = 63;
export const CARD_HEIGHT_MM = 88;
export const ANALYSIS_DPI = 300;

// Textfeld relativ zur Karte. Passt grob für MTG (modern/alt), Pokémon (Attacken) und Yu-Gi-Oh!.
export const TEXT_BOX = { x: 0.08, y: 0.62, w: 0.84, h: 0.3 };

// Kalibriert mit synthetischen Testkarten (Werte siehe PR-Beschreibung):
// Scryfall png/large ~1.05, normal (488 px) ~0.88, 300 px oder 1 px Blur ~0.52, small (146 px) ~0.18.
// Die Auflösung steckt schon im Schärfewert, weil auf 300 DPI skaliert gemessen wird.
export const SHARPNESS_GOOD = 0.75;
export const SHARPNESS_OK = 0.45;

export type QualityRating = "good" | "ok" | "poor" | "unknown";

export interface ImageQuality {
  effectiveDpi: number;
  sharpness: number; // ~0 (matschig) .. ~1 (sehr scharf)
  edgeCoverage: number; // Anteil Kantenpixel im Textfeld; sehr klein = kaum Text gefunden, Wert unsicher
  contrast: number; // Standardabweichung der Helligkeit im Textfeld (0..~128)
  rating: QualityRating;
  millis?: number;
}

// Erhöhen, wenn sich Messung oder Schwellen ändern, damit alte Werte im Cache nicht mehr gelten
export const QUALITY_VERSION = 1;

export interface CropRect {
  offSetX?: number;
  offSetY?: number;
  width?: number;
  height?: number;
}

/** Schlüssel für gespeicherte Messungen: Version plus Crop-Ausschnitt. */
export function qualityCacheKey(crop?: CropRect): string {
  return `v${QUALITY_VERSION}:${crop?.offSetX || 0},${crop?.offSetY || 0},${crop?.width || 0},${crop?.height || 0}`;
}

// Kantenpixel: Gradient über diesem Anteil des 0..255-Bereichs
const EDGE_THRESHOLD = 40;
const MIN_EDGE_COVERAGE = 0.01;
// Ohne Kanten, aber mit Helligkeitsunterschieden: Text ist da, aber so verwaschen, dass keine Kante übrig ist
const MIN_CONTRAST = 12;

/** Graustufen aus RGBA (Rec. 601). */
export function toGray(rgba: Uint8ClampedArray, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
  }
  return gray;
}

export function contrast(gray: Float32Array): number {
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < gray.length; i++) {
    sum += gray[i];
    sq += gray[i] * gray[i];
  }
  const n = gray.length || 1;
  const mean = sum / n;
  return Math.sqrt(Math.max(0, sq / n - mean * mean));
}

/** Kantenschärfe eines Graustufenbildes (siehe Kopfkommentar). */
export function edgeSharpness(gray: Float32Array, width: number, height: number): { sharpness: number; edgeCoverage: number } {
  let lapSum = 0;
  let gradSum = 0;
  let edgePixels = 0;
  const inner = Math.max(0, (width - 2) * (height - 2));
  for (let y = 1; y < height - 1; y++) {
    const row = y * width;
    for (let x = 1; x < width - 1; x++) {
      const i = row + x;
      const l = gray[i - 1], r = gray[i + 1], u = gray[i - width], d = gray[i + width];
      const gx = (r - l) / 2;
      const gy = (d - u) / 2;
      const grad = Math.abs(gx) + Math.abs(gy);
      if (grad < EDGE_THRESHOLD / 2) continue;
      // Laplace in einer 3x3-Nachbarschaft um das Kantenpixel ist am Kantenrand am größten;
      // der Betrag am Pixel selbst reicht als Schätzer, da wir über viele Kanten summieren.
      const lap = Math.abs(l + r + u + d - 4 * gray[i]);
      lapSum += lap;
      gradSum += grad;
      edgePixels++;
    }
  }
  return {
    sharpness: gradSum > 0 ? lapSum / gradSum : 0,
    edgeCoverage: inner > 0 ? edgePixels / inner : 0,
  };
}

export function effectiveDpi(cropWidthPx: number): number {
  return cropWidthPx / (CARD_WIDTH_MM / 25.4);
}

export function rate(sharpness: number, edgeCoverage: number, contrastValue: number): QualityRating {
  if (edgeCoverage < MIN_EDGE_COVERAGE) return contrastValue >= MIN_CONTRAST ? "poor" : "unknown";
  if (sharpness >= SHARPNESS_GOOD) return "good";
  if (sharpness >= SHARPNESS_OK) return "ok";
  return "poor";
}

/** Analyse auf fertigen RGBA-Pixeln des auf 300 DPI skalierten Textfeldes. */
export function analyzePixels(rgba: Uint8ClampedArray, width: number, height: number, cropWidthPx: number): ImageQuality {
  const gray = toGray(rgba, width, height);
  const { sharpness, edgeCoverage } = edgeSharpness(gray, width, height);
  const c = contrast(gray);
  return {
    effectiveDpi: Math.round(effectiveDpi(cropWidthPx)),
    sharpness: Math.round(sharpness * 100) / 100,
    edgeCoverage: Math.round(edgeCoverage * 1000) / 1000,
    contrast: Math.round(c),
    rating: rate(sharpness, edgeCoverage, c),
  };
}

type SizedImage = CanvasImageSource & { naturalWidth: number; naturalHeight: number };

/**
 * Misst die Qualität des Textfeldes. Das Bild muss CORS-sauber sein (alle Bilder werden mit
 * crossOrigin="Anonymous" oder als Blob über /api/proxy/image geladen), sonst ist keine Aussage möglich (null).
 *
 * Ausschneiden und Skalieren macht createImageBitmap asynchron außerhalb des Main-Threads; auf dem
 * Main-Thread bleibt nur getImageData plus eine Schleife über ~620x310 Pixel (wenige ms).
 */
export async function measureImageQuality(img: SizedImage, crop?: CropRect): Promise<ImageQuality | null> {
  const start = typeof performance !== "undefined" ? performance.now() : 0;
  const offX = crop?.offSetX || 0;
  const offY = crop?.offSetY || 0;
  const cropW = crop?.width && crop.width > 0 ? crop.width : img.naturalWidth;
  const cropH = crop?.height && crop.height > 0 ? crop.height : img.naturalHeight;
  if (!cropW || !cropH) return null;

  const srcX = Math.round(offX + TEXT_BOX.x * cropW);
  const srcY = Math.round(offY + TEXT_BOX.y * cropH);
  const srcW = Math.max(1, Math.round(TEXT_BOX.w * cropW));
  const srcH = Math.max(1, Math.round(TEXT_BOX.h * cropH));

  const pxPerMm = ANALYSIS_DPI / 25.4;
  const dstW = Math.round(TEXT_BOX.w * CARD_WIDTH_MM * pxPerMm);
  const dstH = Math.round(TEXT_BOX.h * CARD_HEIGHT_MM * pxPerMm);

  const canvas = document.createElement("canvas");
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
  if (!ctx) return null;

  let bitmap: ImageBitmap | null = null;
  try {
    if (typeof createImageBitmap === "function") {
      bitmap = await createImageBitmap(img, srcX, srcY, srcW, srcH, {
        resizeWidth: dstW,
        resizeHeight: dstH,
        resizeQuality: "high",
      });
    }
  } catch (e) {
    bitmap = null; // z.B. ältere Safari ohne resize-Optionen
  }

  try {
    if (bitmap && bitmap.width === dstW && bitmap.height === dstH) {
      ctx.drawImage(bitmap, 0, 0);
    } else {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, dstW, dstH);
    }
    const data = ctx.getImageData(0, 0, dstW, dstH);
    const result = analyzePixels(data.data, dstW, dstH, cropW);
    result.millis = typeof performance !== "undefined" ? Math.round(performance.now() - start) : undefined;
    return result;
  } catch (e) {
    // Tainted canvas (Bild ohne CORS) – keine Aussage möglich
    return null;
  } finally {
    bitmap?.close();
  }
}

// Eine Messung nach der anderen, jeweils wenn der Browser Luft hat, damit ein volles Grid nicht ruckelt.
let chain: Promise<unknown> = Promise.resolve();
const idle = (): Promise<void> =>
  new Promise((resolve) => {
    const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined;
    if (ric) ric(() => resolve(), { timeout: 500 });
    else setTimeout(resolve, 0);
  });

export function queueImageQuality(img: SizedImage, crop?: CropRect): Promise<ImageQuality | null> {
  const run = chain.then(idle).then(() => measureImageQuality(img, crop));
  chain = run.catch(() => null);
  return run;
}
