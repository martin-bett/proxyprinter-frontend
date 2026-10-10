import { PdfSettings } from './SettingsDialog';

/**
 * Seitenlayout wie in DocumentGenerator.java (Backend): A4 (hoch oder quer) in Punkt, 10 mm Seitenrand,
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
  /** Karten liegen quer: das Bild wird im Uhrzeigersinn gedreht */
  rotated: boolean;
  cardsPerRow: number;
  cardsPerColumn: number;
  slots: CardSlot[];
  /** Abstand der Schnittlinien zum Seitenrand */
  gridMargin: number;
}

export const computePageLayout = (
  settings: Pick<PdfSettings, 'width' | 'height' | 'hmargin' | 'vmargin'> & Partial<Pick<PdfSettings, 'pageLandscape' | 'cardsLandscape'>>,
): PageLayout => {
  const pageWidth = settings.pageLandscape ? PAGE_HEIGHT_PT : PAGE_WIDTH_PT;
  const pageHeight = settings.pageLandscape ? PAGE_WIDTH_PT : PAGE_HEIGHT_PT;
  const hMargin = (settings.hmargin || 0) * MM_TO_PT;
  const vMargin = (settings.vmargin || 0) * MM_TO_PT;
  // Querliegende Karten belegen einen um 90° gedrehten Platz
  const cardWidth = ((settings.cardsLandscape ? settings.height : settings.width) || 0) * MM_TO_PT;
  const cardHeight = ((settings.cardsLandscape ? settings.width : settings.height) || 0) * MM_TO_PT;

  const fits = cardWidth > 0 && cardHeight > 0;
  const cardsPerRow = fits ? Math.max(0, Math.floor((pageWidth - 2 * PAGE_MARGIN_PT + hMargin) / (cardWidth + hMargin))) : 0;
  const cardsPerColumn = fits ? Math.max(0, Math.floor((pageHeight - 2 * PAGE_MARGIN_PT + vMargin) / (cardHeight + vMargin))) : 0;

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
    pageWidth,
    pageHeight,
    cardWidth,
    cardHeight,
    rotated: !!settings.cardsLandscape,
    cardsPerRow,
    cardsPerColumn,
    slots,
    gridMargin: PAGE_MARGIN_PT / 6,
  };
};

/** Kartenradius der Eckmarken wie im Backend (3 % der langen Kartenseite). */
export const cornerRadius = (cardWidth: number, cardHeight: number): number => Math.max(cardWidth, cardHeight) * 0.03;

/** Schnittlinien: sortierte, eindeutige Kartenkanten plus die Seitenränder, wie drawGridLines im Backend. */
export const gridLinePositions = (layout: PageLayout, cardCount: number): { vertical: number[]; horizontal: number[] } => {
  const used = layout.slots.slice(0, cardCount);
  const unique = (values: number[]) => Array.from(new Set(values.map(v => Math.round(v * 100) / 100))).sort((a, b) => a - b);
  return {
    vertical: [layout.gridMargin, ...unique(used.flatMap(s => [s.x, s.x + layout.cardWidth])), layout.pageWidth - layout.gridMargin],
    horizontal: [layout.gridMargin, ...unique(used.flatMap(s => [s.y, s.y + layout.cardHeight])), layout.pageHeight - layout.gridMargin],
  };
};
