import { PdfSettings } from './SettingsDialog';

/**
 * Seitenlayout wie in DocumentGenerator.java (Backend): A4 in Punkt, 10 mm Seitenrand,
 * Karten von links oben zeilenweise. Wer dort etwas ändert, muss das hier nachziehen.
 */
export const MM_TO_PT = 2.83;
export const PAGE_WIDTH_PT = 595.28;
export const PAGE_HEIGHT_PT = 841.89;
const PAGE_MARGIN_PT = 10 * MM_TO_PT;

/** Position einer Karte in PDF-Punkten, Ursprung links oben (das PDF selbst zählt von unten). */
export interface CardSlot {
  x: number;
  y: number;
}

export interface PageLayout {
  pageWidth: number;
  pageHeight: number;
  cardWidth: number;
  cardHeight: number;
  cardsPerRow: number;
  cardsPerColumn: number;
  slots: CardSlot[];
  /** Abstand der Schnittlinien zum Seitenrand */
  gridMargin: number;
}

export const computePageLayout = (settings: Pick<PdfSettings, 'width' | 'height' | 'hmargin' | 'vmargin'>): PageLayout => {
  const hMargin = (settings.hmargin || 0) * MM_TO_PT;
  const vMargin = (settings.vmargin || 0) * MM_TO_PT;
  const cardWidth = (settings.width || 0) * MM_TO_PT;
  const cardHeight = (settings.height || 0) * MM_TO_PT;

  const fits = cardWidth > 0 && cardHeight > 0;
  const cardsPerRow = fits ? Math.max(0, Math.floor((PAGE_WIDTH_PT - 2 * PAGE_MARGIN_PT + hMargin) / (cardWidth + hMargin))) : 0;
  const cardsPerColumn = fits ? Math.max(0, Math.floor((PAGE_HEIGHT_PT - 2 * PAGE_MARGIN_PT + vMargin) / (cardHeight + vMargin))) : 0;

  const slots: CardSlot[] = [];
  for (let row = 0; row < cardsPerColumn; row++) {
    for (let col = 0; col < cardsPerRow; col++) {
      slots.push({
        x: PAGE_MARGIN_PT + col * (cardWidth + hMargin),
        y: PAGE_MARGIN_PT + row * (cardHeight + vMargin),
      });
    }
  }

  return {
    pageWidth: PAGE_WIDTH_PT,
    pageHeight: PAGE_HEIGHT_PT,
    cardWidth,
    cardHeight,
    cardsPerRow,
    cardsPerColumn,
    slots,
    gridMargin: PAGE_MARGIN_PT / 6,
  };
};

/**
 * Radius der Eckmarken in Punkt wie DocumentGenerator.cornerRadius im Backend: ohne cornerSize AUTO_CORNER_RATIO der Kartenhöhe,
 * sonst cornerSize in mm, höchstens die halbe kürzere Kartenseite.
 */
export const cornerRadius = (cardWidth: number, cardHeight: number, cornerSize?: number | null): number => {
  if (cornerSize == null || cornerSize < 0) {
    return cardHeight * AUTO_CORNER_RATIO;
  }
  return Math.min(cornerSize * MM_TO_PT, Math.min(cardWidth, cardHeight) / 2);
};

/** Echte Karten: Eckradius 1/8 Zoll (3,175 mm) bei 88,9 mm Höhe (DocumentGenerator.AUTO_CORNER_RATIO). */
export const AUTO_CORNER_RATIO = 3.175 / 88.9;

/** Bézier-Faktor für den Viertelkreis der Eckmarken (DocumentGenerator.KAPPA). */
export const CORNER_KAPPA = 0.5523;

/** Automatischer Eckradius in mm für eine Kartenhöhe in mm, gerundet auf 0,1 mm (Platzhalter im Dialog). */
export const autoCornerSizeMm = (heightMm: number): number => Math.round((heightMm || 0) * AUTO_CORNER_RATIO * 10) / 10;

/** Schnittlinien: sortierte, eindeutige Kartenkanten plus die Seitenränder, wie drawGridLines im Backend. */
export const gridLinePositions = (layout: PageLayout, cardCount: number): { vertical: number[]; horizontal: number[] } => {
  const used = layout.slots.slice(0, cardCount);
  const unique = (values: number[]) => Array.from(new Set(values.map(v => Math.round(v * 100) / 100))).sort((a, b) => a - b);
  return {
    vertical: [layout.gridMargin, ...unique(used.flatMap(s => [s.x, s.x + layout.cardWidth])), layout.pageWidth - layout.gridMargin],
    horizontal: [layout.gridMargin, ...unique(used.flatMap(s => [s.y, s.y + layout.cardHeight])), layout.pageHeight - layout.gridMargin],
  };
};
