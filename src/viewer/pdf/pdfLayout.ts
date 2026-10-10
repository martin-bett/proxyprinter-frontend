import { PdfSettings } from './SettingsDialog';

/**
 * Seitenlayout wie in DocumentGenerator.java (Backend): A4 (hoch oder quer) in Punkt, exakte mm,
 * Raster mittig mit mindestens 5 mm Seitenrand, Karten von links oben zeilenweise.
 * Wer dort etwas ändert, muss das hier nachziehen.
 */
export const MM_TO_PT = 72 / 25.4;
export const PAGE_WIDTH_PT = 595.28;
export const PAGE_HEIGHT_PT = 841.89;
const MIN_PAGE_MARGIN_PT = 5 * MM_TO_PT;
const GRID_MARGIN_PT = (10 / 6) * MM_TO_PT;

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

/** Wie DocumentGenerator.cardsThatFit: Karten pro Reihe bzw. Spalte mit Mindestrand auf beiden Seiten. */
const cardsThatFit = (pageSize: number, cardSize: number, gap: number): number =>
  cardSize > 0 ? Math.max(0, Math.floor((pageSize - 2 * MIN_PAGE_MARGIN_PT + gap) / (cardSize + gap))) : 0;

/** Wie DocumentGenerator.centeredOffset: Rand, damit das Raster mittig sitzt. */
const centeredOffset = (pageSize: number, count: number, cardSize: number, gap: number): number =>
  Math.max(0, (pageSize - (count * cardSize + Math.max(0, count - 1) * gap)) / 2);

export const computePageLayout = (
  settings: Pick<PdfSettings, 'width' | 'height' | 'hmargin' | 'vmargin'> & { landscape?: boolean },
): PageLayout => {
  // Quer tauschen nur die Seitenmaße, die Karten bleiben aufrecht
  const pageWidth = settings.landscape ? PAGE_HEIGHT_PT : PAGE_WIDTH_PT;
  const pageHeight = settings.landscape ? PAGE_WIDTH_PT : PAGE_HEIGHT_PT;
  const hMargin = (settings.hmargin || 0) * MM_TO_PT;
  const vMargin = (settings.vmargin || 0) * MM_TO_PT;
  const cardWidth = (settings.width || 0) * MM_TO_PT;
  const cardHeight = (settings.height || 0) * MM_TO_PT;

  const fits = cardWidth > 0 && cardHeight > 0;
  const cardsPerRow = fits ? cardsThatFit(pageWidth, cardWidth, hMargin) : 0;
  const cardsPerColumn = fits ? cardsThatFit(pageHeight, cardHeight, vMargin) : 0;
  const startX = centeredOffset(pageWidth, cardsPerRow, cardWidth, hMargin);
  const startY = centeredOffset(pageHeight, cardsPerColumn, cardHeight, vMargin);

  const slots: CardSlot[] = [];
  for (let row = 0; row < cardsPerColumn; row++) {
    for (let col = 0; col < cardsPerRow; col++) {
      slots.push({
        x: startX + col * (cardWidth + hMargin),
        y: startY + row * (cardHeight + vMargin),
      });
    }
  }

  return {
    pageWidth,
    pageHeight,
    cardWidth,
    cardHeight,
    cardsPerRow,
    cardsPerColumn,
    slots,
    gridMargin: GRID_MARGIN_PT,
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
