import { CropSettings } from '../../../service/ApiFactory';

/** Rechteck in Bildpixeln (natürliche Bildgröße). */
export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridOptions {
  rows: number;
  cols: number;
  /** Außenrand in Pixeln, wird innerhalb des Ausschnitts an allen vier Seiten abgezogen. */
  margin: number;
  /** Abstand zwischen den Kacheln in Pixeln. */
  gap: number;
}

export interface TileSize {
  width: number;
  height: number;
}

const clampInt = (value: number, min: number) => Math.max(min, Math.floor(Number.isFinite(value) ? value : min));

/** Größe einer Kachel, wenn der Ausschnitt in rows x cols geteilt wird. */
export const tileSize = (area: PixelRect, options: GridOptions): TileSize => {
  const rows = clampInt(options.rows, 1);
  const cols = clampInt(options.cols, 1);
  const margin = clampInt(options.margin, 0);
  const gap = clampInt(options.gap, 0);
  return {
    width: Math.floor((area.width - 2 * margin - (cols - 1) * gap) / cols),
    height: Math.floor((area.height - 2 * margin - (rows - 1) * gap) / rows),
  };
};

/**
 * Teilt den Ausschnitt in rows x cols Kacheln, mit Außenrand und Abständen.
 * Liefert die Kacheln zeilenweise (links nach rechts, oben nach unten) oder eine leere Liste,
 * wenn Rand und Abstände keinen Platz mehr lassen.
 */
export const computeGridCrops = (area: PixelRect, options: GridOptions): CropSettings[] => {
  const rows = clampInt(options.rows, 1);
  const cols = clampInt(options.cols, 1);
  const margin = clampInt(options.margin, 0);
  const gap = clampInt(options.gap, 0);
  const tile = tileSize(area, { rows, cols, margin, gap });
  if (tile.width <= 0 || tile.height <= 0) return [];

  const crops: CropSettings[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      crops.push({
        offSetX: Math.round(area.x) + margin + col * (tile.width + gap),
        offSetY: Math.round(area.y) + margin + row * (tile.height + gap),
        width: tile.width,
        height: tile.height,
        isStretch: true,
      });
    }
  }
  return crops;
};

/** Größter zentrierter Ausschnitt mit dem Seitenverhältnis aspect, in Prozent des Bildes. */
export const centeredAspectPercent = (naturalWidth: number, naturalHeight: number, aspect: number) => {
  const imageAspect = naturalWidth / naturalHeight;
  let width = 100;
  let height = 100;
  if (imageAspect > aspect) {
    width = (aspect / imageAspect) * 100;
  } else {
    height = (imageAspect / aspect) * 100;
  }
  return { unit: '%' as const, x: (100 - width) / 2, y: (100 - height) / 2, width, height };
};

/** Prozent-Ausschnitt in Bildpixel umrechnen. */
export const percentToPixels = (
  crop: { x: number; y: number; width: number; height: number },
  naturalWidth: number,
  naturalHeight: number
): PixelRect => {
  const x = Math.max(0, Math.round((crop.x / 100) * naturalWidth));
  const y = Math.max(0, Math.round((crop.y / 100) * naturalHeight));
  return {
    x,
    y,
    width: Math.min(naturalWidth - x, Math.round((crop.width / 100) * naturalWidth)),
    height: Math.min(naturalHeight - y, Math.round((crop.height / 100) * naturalHeight)),
  };
};

/** Bildpixel in Prozent des Bildes umrechnen (für react-image-crop). */
export const pixelsToPercent = (rect: PixelRect, naturalWidth: number, naturalHeight: number) => ({
  unit: '%' as const,
  x: (rect.x / naturalWidth) * 100,
  y: (rect.y / naturalHeight) * 100,
  width: (rect.width / naturalWidth) * 100,
  height: (rect.height / naturalHeight) * 100,
});

/** Rechteck so verschieben und kürzen, dass es ganz im Bild liegt. */
export const clampRect = (rect: PixelRect, naturalWidth: number, naturalHeight: number): PixelRect => {
  const width = Math.max(1, Math.min(Math.round(rect.width), naturalWidth));
  const height = Math.max(1, Math.min(Math.round(rect.height), naturalHeight));
  return {
    x: Math.max(0, Math.min(Math.round(rect.x), naturalWidth - width)),
    y: Math.max(0, Math.min(Math.round(rect.y), naturalHeight - height)),
    width,
    height,
  };
};

/** Größtes Rechteck mit Seitenverhältnis aspect, zentriert innerhalb von rect. */
export const fitAspectInside = (rect: PixelRect, aspect: number): PixelRect => {
  let width = rect.width;
  let height = width / aspect;
  if (height > rect.height) {
    height = rect.height;
    width = height * aspect;
  }
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
};

/** Anzeigegröße für ein Bild, das in maxWidth x maxHeight passen soll, ohne Verzerrung. */
export const fitDisplaySize = (naturalWidth: number, naturalHeight: number, maxWidth: number, maxHeight: number) => {
  const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1);
  return { width: Math.max(1, Math.floor(naturalWidth * scale)), height: Math.max(1, Math.floor(naturalHeight * scale)) };
};
