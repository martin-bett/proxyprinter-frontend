import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CropSettings } from '../../service/ApiFactory';
import { PdfSettings } from './SettingsDialog';
import { computePageLayout, cornerRadius, gridLinePositions, PageLayout } from './pdfLayout';

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

/** Mittel der vier Randpixel wie getBorderColor im Backend. */
const borderColor = (img: HTMLImageElement, rect: { x: number; y: number; w: number; h: number }): string => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '#000000';
    ctx.drawImage(img, 0, 0);
    const pts = [
      [rect.x + Math.floor(rect.w / 2), rect.y + 1],
      [rect.x + Math.floor(rect.w / 2), rect.y + rect.h - 2],
      [rect.x + 1, rect.y + Math.floor(rect.h / 2)],
      [rect.x + rect.w - 2, rect.y + Math.floor(rect.h / 2)],
    ];
    const sum = [0, 0, 0];
    pts.forEach(([px, py]) => {
      const d = ctx.getImageData(px, py, 1, 1).data;
      sum[0] += d[0]; sum[1] += d[1]; sum[2] += d[2];
    });
    return `rgb(${Math.floor(sum[0] / 4)},${Math.floor(sum[1] / 4)},${Math.floor(sum[2] / 4)})`;
  } catch {
    return '#000000';
  }
};

const drawCorners = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) => {
  ctx.fillStyle = color;
  // dx/dy zeigen von der Ecke ins Kartenfeld; die Kurve bauchte im Backend leicht zur Ecke hin
  const corners: [number, number, number, number][] = [
    [x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1],
  ];
  corners.forEach(([cx, cy, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx * r, cy);
    ctx.bezierCurveTo(cx + dx * 0.43 * r, cy + dy * 0.18 * r, cx + dx * 0.18 * r, cy + dy * 0.43 * r, cx, cy + dy * r);
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
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, slot.x, slot.y, layout.cardWidth, layout.cardHeight);
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
      const color = !settings.cornerColorAuto
        ? settings.cornerColor
        : img ? borderColor(img, cropRect(img.naturalWidth, img.naturalHeight, cards[i].cropSettings)) : '#000000';
      drawCorners(ctx, slot.x, slot.y, layout.cardWidth, layout.cardHeight,
        cornerRadius(layout.cardWidth, layout.cardHeight, settings.cornerSize), color);
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

/** Eine A4-Beispielseite, die sich mit den Einstellungen im Dialog mitändert. */
export function PdfPagePreview({ settings, cards, width = 340 }: PdfPagePreviewProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fitsOnPage, setFitsOnPage] = useState(true);

  const layout = useMemo(
    () => computePageLayout(settings),
    [settings.width, settings.height, settings.hmargin, settings.vmargin] // eslint-disable-line react-hooks/exhaustive-deps
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
