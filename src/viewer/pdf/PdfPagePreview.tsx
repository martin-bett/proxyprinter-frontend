import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CropSettings } from '../../service/ApiFactory';
import { PdfSettings } from './SettingsDialog';
import { computePageLayout, CORNER_KAPPA, cornerRadius, gridLinePositions, PageLayout } from './pdfLayout';

export interface PreviewCard {
  imageUrl: string;
  cropSettings?: CropSettings;
}

type PreviewSettings = Omit<PdfSettings, 'email' | 'maxDpi'>;

/** Quellrechteck des Zuschnitts, wie cropImage im Backend. */
export const cropRect = (imgW: number, imgH: number, crop?: CropSettings): { x: number; y: number; w: number; h: number } => {
  if (!crop) return { x: 0, y: 0, w: imgW, h: imgH };
  const x = Math.max(0, crop.offSetX ?? 0);
  const y = Math.max(0, crop.offSetY ?? 0);
  const cropW = crop.width && crop.width > 0 ? crop.width : imgW;
  const cropH = crop.height && crop.height > 0 ? crop.height : imgH;
  const w = Math.min(imgW - x, cropW);
  const h = Math.min(imgH - y, cropH);
  return w > 0 && h > 0 ? { x, y, w, h } : { x: 0, y: 0, w: imgW, h: imgH };
};

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

const loadImage = (url: string): Promise<HTMLImageElement | null> => {
  let cached = imageCache.get(url);
  if (!cached) {
    const attempt = (crossOrigin: boolean) => new Promise<HTMLImageElement | null>(resolve => {
      const img = new Image();
      if (crossOrigin) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    // Ohne CORS lässt sich das Bild zeichnen, aber nicht auslesen (Eckfarbe fällt dann auf Schwarz zurück)
    cached = attempt(true).then(img => img ?? attempt(false));
    imageCache.set(url, cached);
  }
  return cached;
};

type Rect = { x: number; y: number; w: number; h: number };
type Rgb = [number, number, number];
/** Farben einer Ecke: [waagerechte Kante, senkrechte Kante] */
type CornerColors = [Rgb, Rgb];

const rgb = (c: Rgb) => `rgb(${c[0]},${c[1]},${c[2]})`;

/**
 * Automatische Eckfarben wie cornerEdgeColors im Backend: je Ecke (oben links, oben rechts, unten links,
 * unten rechts) dort gemessen, wo der Bogen auf die beiden Kartenkanten trifft, gemittelt über 3 x 3 Pixel;
 * durchsichtige Pixel zählen nicht, Rückfall ist das Mittel der vier Randmitten. null, wenn das Bild
 * wegen CORS nicht lesbar ist.
 */
export const cornerEdgeColors = (
  readPixel: (x: number, y: number) => [number, number, number, number],
  rect: Rect,
  radiusOfWidth: number,
  radiusOfHeight: number,
): CornerColors[] => {
  const sample = (x: number, y: number): Rgb | null => {
    const sum = [0, 0, 0];
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = Math.max(0, Math.min(rect.w - 1, x + dx));
        const py = Math.max(0, Math.min(rect.h - 1, y + dy));
        const [r, g, b, a] = readPixel(rect.x + px, rect.y + py);
        if (a < 128) continue;
        sum[0] += r; sum[1] += g; sum[2] += b;
        n++;
      }
    }
    return n === 0 ? null : [Math.floor(sum[0] / n), Math.floor(sum[1] / n), Math.floor(sum[2] / n)];
  };
  const { w, h } = rect;
  const inset = 2;
  const along = 3;
  const rx = Math.min(w - 1 - inset, Math.round(radiusOfWidth * w) + along);
  const ry = Math.min(h - 1 - inset, Math.round(radiusOfHeight * h) + along);
  let fallback: Rgb | null = null;
  const average = (): Rgb => {
    if (!fallback) {
      const pts = [[Math.floor(w / 2), 1], [Math.floor(w / 2), h - 2], [1, Math.floor(h / 2)], [w - 2, Math.floor(h / 2)]];
      const sum = [0, 0, 0];
      pts.forEach(([x, y]) => { const [r, g, b] = readPixel(rect.x + x, rect.y + y); sum[0] += r; sum[1] += g; sum[2] += b; });
      fallback = [Math.floor(sum[0] / 4), Math.floor(sum[1] / 4), Math.floor(sum[2] / 4)];
    }
    return fallback;
  };
  return [0, 1, 2, 3].map(quadrant => {
    const left = quadrant === 0 || quadrant === 2;
    const top = quadrant === 0 || quadrant === 1;
    const edgeX = left ? inset : w - 1 - inset;
    const edgeY = top ? inset : h - 1 - inset;
    const horizontal = sample(left ? rx : w - 1 - rx, edgeY) ?? average();
    const vertical = sample(edgeX, top ? ry : h - 1 - ry) ?? average();
    return [horizontal, vertical] as CornerColors;
  });
};

/**
 * Eckfarben des aufrechten Bildes auf die im Uhrzeigersinn gedrehte Karte umlegen: Ecke links oben kommt
 * nach rechts oben usw., und die waagerechte Kante wird zur senkrechten.
 */
export const rotateCornerColors = (colors: CornerColors[]): CornerColors[] =>
  [2, 0, 3, 1].map(from => [colors[from][1], colors[from][0]] as CornerColors);

const readCornerColors = (img: HTMLImageElement, rect: Rect, radiusOfWidth: number, radiusOfHeight: number): CornerColors[] | null => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const read = (x: number, y: number): [number, number, number, number] => {
      const i = (y * canvas.width + x) * 4;
      return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    };
    return cornerEdgeColors(read, rect, radiusOfWidth, radiusOfHeight);
  } catch {
    return null;
  }
};

/** Wie colorDistance/drawRoundedCorner im Backend: fast gleiche Farben werden einfarbig gemischt. */
const nearlyEqual = (a: Rgb, b: Rgb) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])) <= 6;

/** colors: eine feste Farbe für alle Ecken oder je Ecke die Farben der beiden angrenzenden Kanten. */
const drawCorners = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, colors: string | CornerColors[]) => {
  // dx/dy zeigen von der Ecke ins Kartenfeld; Viertelkreis wie drawRoundedCorner im Backend
  const corners: [number, number, number, number][] = [
    [x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1],
  ];
  corners.forEach(([cx, cy, dx, dy], quadrant) => {
    if (typeof colors === 'string') {
      ctx.fillStyle = colors;
    } else {
      const [horizontal, vertical] = colors[quadrant];
      if (nearlyEqual(horizontal, vertical)) {
        ctx.fillStyle = rgb([0, 1, 2].map(k => Math.floor((horizontal[k] + vertical[k]) / 2)) as Rgb);
      } else {
        const gradient = ctx.createLinearGradient(cx + dx * r, cy, cx, cy + dy * r);
        gradient.addColorStop(0, rgb(horizontal));
        gradient.addColorStop(1, rgb(vertical));
        ctx.fillStyle = gradient;
      }
    }
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx * r, cy);
    const handle = r * (1 - CORNER_KAPPA);
    ctx.bezierCurveTo(cx + dx * handle, cy, cx, cy + dy * handle, cx, cy + dy * r);
    ctx.closePath();
    ctx.fill();
  });
};

interface PreviewPalette {
  paper: string;
  slotLine: string;
  placeholder: string;
  placeholderLine: string;
  shadow: string;
}

/** Farben aus dem aktiven Theme (CSS-Variablen auf <html>), mit festen Rückfallwerten. */
const readPalette = (): PreviewPalette => {
  const style = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const v = (name: string, fallback: string) => style?.getPropertyValue(`--${name}`).trim() || fallback;
  return {
    paper: v('surface', '#ffffff'),
    slotLine: v('border', '#dbdbdb'),
    placeholder: v('accent-soft', '#d9e6ff'),
    placeholderLine: v('accent-strong', '#3273dc'),
    shadow: v('shadow', 'rgba(0,0,0,0.3)'),
  };
};

const drawPage = async (
  canvas: HTMLCanvasElement,
  layout: PageLayout,
  settings: PreviewSettings,
  cards: PreviewCard[],
  isCurrent: () => boolean,
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const scale = canvas.width / layout.pageWidth;
  const images = await Promise.all(cards.slice(0, layout.slots.length).map(c => loadImage(c.imageUrl)));
  if (!isCurrent()) return;

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const palette = readPalette();
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, layout.pageWidth, layout.pageHeight);

  const placed = cards.length > 0 ? Math.min(cards.length, layout.slots.length) : layout.slots.length;

  // Freie Plätze nur als dezente Umrisse, damit die belegten Karten im Vordergrund stehen
  ctx.save();
  ctx.strokeStyle = palette.slotLine;
  ctx.lineWidth = 0.75;
  ctx.setLineDash([4, 3]);
  layout.slots.slice(placed).forEach(slot => ctx.strokeRect(slot.x, slot.y, layout.cardWidth, layout.cardHeight));
  ctx.restore();

  layout.slots.slice(0, placed).forEach((slot, i) => {
    const img = images[i];
    ctx.save();
    ctx.shadowColor = palette.shadow;
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    if (img) {
      const rect = cropRect(img.naturalWidth, img.naturalHeight, cards[i].cropSettings);
      if (layout.rotated) {
        // Im Uhrzeigersinn gedreht wie rotateClockwise im Backend
        ctx.translate(slot.x + layout.cardWidth, slot.y);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, layout.cardHeight, layout.cardWidth);
      } else {
        ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, slot.x, slot.y, layout.cardWidth, layout.cardHeight);
      }
    } else {
      ctx.fillStyle = palette.placeholder;
      ctx.fillRect(slot.x, slot.y, layout.cardWidth, layout.cardHeight);
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = palette.placeholderLine;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(slot.x, slot.y, layout.cardWidth, layout.cardHeight);
    }
    ctx.restore();
    if (settings.corners) {
      const r = cornerRadius(layout.cardWidth, layout.cardHeight, settings.cornerSize);
      // Ohne lesbares Bild (Platzhalter, CORS) fällt die automatische Farbe auf Schwarz zurück
      // Gedrehte Karten: gemessen wird am aufrechten Bild, dessen Breite auf der Platzhöhe liegt
      const [imgW, imgH] = layout.rotated ? [layout.cardHeight, layout.cardWidth] : [layout.cardWidth, layout.cardHeight];
      const measured = settings.cornerColorAuto && img
        ? readCornerColors(img, cropRect(img.naturalWidth, img.naturalHeight, cards[i].cropSettings), r / imgW, r / imgH)
        : null;
      const colors = !settings.cornerColorAuto
        ? settings.cornerColor
        : (measured && (layout.rotated ? rotateCornerColors(measured) : measured)) || '#000000';
      drawCorners(ctx, slot.x, slot.y, layout.cardWidth, layout.cardHeight, r, colors);
    }
  });

  if (settings.cutlines) {
    const { vertical, horizontal } = gridLinePositions(layout, placed);
    ctx.strokeStyle = settings.cutlineColor;
    ctx.lineWidth = (settings.cutlineThickness || 3) * 0.5;
    ctx.beginPath();
    vertical.forEach(x => { ctx.moveTo(x, layout.gridMargin); ctx.lineTo(x, layout.pageHeight - layout.gridMargin); });
    horizontal.forEach(y => { ctx.moveTo(layout.gridMargin, y); ctx.lineTo(layout.pageWidth - layout.gridMargin, y); });
    ctx.stroke();
  }
};

interface PdfPagePreviewProps {
  settings: PreviewSettings;
  /** Die ersten Karten des Decks in PDF-Reihenfolge; leer = Platzhalter */
  cards: PreviewCard[];
  /** Breite der Vorschau in CSS-Pixeln */
  width?: number;
}

/** Eine A4-Beispielseite (hoch oder quer), die sich mit den Einstellungen im Dialog mitändert. */
export function PdfPagePreview({ settings, cards, width = 340 }: PdfPagePreviewProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fitsOnPage, setFitsOnPage] = useState(true);

  const layout = useMemo(
    () => computePageLayout(settings),
    [settings.width, settings.height, settings.hmargin, settings.vmargin, settings.pageLandscape, settings.cardsLandscape] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    setFitsOnPage(layout.slots.length > 0);
    const canvas = canvasRef.current;
    if (!canvas) return;
    let current = true;
    drawPage(canvas, layout, settings, cards, () => current).catch(() => undefined);
    return () => { current = false; };
  }, [layout, cards, settings.cutlines, settings.cutlineColor, settings.cutlineThickness, settings.corners, settings.cornerColor, settings.cornerColorAuto, settings.cornerSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const height = Math.round(width * layout.pageHeight / layout.pageWidth);

  return (
    <div className="pdf-page-preview">
      <canvas
        ref={canvasRef}
        width={Math.round(width * dpr)}
        height={Math.round(height * dpr)}
        style={{ width, height }}
        aria-label={t('pdf.preview.ariaLabel')}
      />
      <p className="help">
        {fitsOnPage
          ? `${layout.cardsPerRow} × ${layout.cardsPerColumn} = ${layout.slots.length}`
          : t('pdf.preview.doesNotFit')}
      </p>
    </div>
  );
}
