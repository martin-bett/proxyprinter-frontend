import { PdfSettings, RegistrationMarkStyle } from './SettingsDialog';

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
  /** Karten liegen quer: das Bild wird im Uhrzeigersinn gedreht */
  rotated: boolean;
  cardsPerRow: number;
  cardsPerColumn: number;
  slots: CardSlot[];
  /** Abstand der Schnittlinien zum Seitenrand */
  gridMargin: number;
  /** Passmarken für den Schneideplotter; fehlt = keine */
  registration?: RegistrationLayout;
}

export interface RegistrationLayout {
  style: RegistrationMarkStyle;
  /** Armlänge in mm, wie sie in Silhouette Studio eingestellt werden muss */
  lengthMm: number;
}

/**
 * Silhouette-Passmarken wie RegistrationMarks.java im Backend: Abstand zur Blattkante, Armlänge 5 bis 20 mm,
 * Linienstärke und Quadrat (3 Marken) in mm; zwischen Marke und Karte bleibt CLEARANCE frei.
 */
export const REGISTRATION = {
  insetMm: 10,
  minLengthMm: 5,
  maxLengthMm: 20,
  thicknessMm: 0.5,
  squareMm: 5,
  clearanceMm: 2,
};

/** Wie RegistrationMarks.markLength: längste Armlänge in ganzen mm bei freeMm Rand, höchstens 20 mm. */
export const registrationMarkLength = (freeMm: number): number =>
  Math.floor(Math.min(REGISTRATION.maxLengthMm, freeMm - REGISTRATION.insetMm - REGISTRATION.clearanceMm) + 0.001);

/**
 * Wie RegistrationMarks.grid: meiste Karten zwischen den Marken, ohne in einen Eckbereich zu reichen,
 * bei Gleichstand längere Arme; passt keine Karte frei, eine Karte mittig mit kürzesten Armen.
 */
const registrationGrid = (pageWidth: number, pageHeight: number, cardWidth: number, cardHeight: number, hGap: number, vGap: number) => {
  const inset = REGISTRATION.insetMm * MM_TO_PT;
  const between = (space: number, card: number, gap: number) =>
    card > 0 && space > 0 ? Math.max(0, Math.floor((space + gap) / (card + gap))) : 0;
  const maxCols = between(pageWidth - 2 * inset, cardWidth, hGap);
  const maxRows = between(pageHeight - 2 * inset, cardHeight, vGap);
  let best = { cols: 1, rows: 1, lengthMm: REGISTRATION.minLengthMm, found: false };
  for (let cols = maxCols; cols >= 1; cols--) {
    for (let rows = maxRows; rows >= 1; rows--) {
      const left = centeredOffset(pageWidth, cols, cardWidth, hGap);
      const top = centeredOffset(pageHeight, rows, cardHeight, vGap);
      const lengthMm = registrationMarkLength(Math.max(left, top) / MM_TO_PT);
      if (lengthMm < REGISTRATION.minLengthMm) continue;
      const count = cols * rows;
      const bestCount = best.found ? best.cols * best.rows : 0;
      if (count > bestCount || (count === bestCount && lengthMm > best.lengthMm)) {
        best = { cols, rows, lengthMm, found: true };
      }
    }
  }
  return best;
};

/** Wie DocumentGenerator.cardsThatFit: Karten pro Reihe bzw. Spalte mit Mindestrand auf beiden Seiten. */
const cardsThatFit = (pageSize: number, cardSize: number, gap: number): number =>
  cardSize > 0 ? Math.max(0, Math.floor((pageSize - 2 * MIN_PAGE_MARGIN_PT + gap) / (cardSize + gap))) : 0;

/** Wie DocumentGenerator.centeredOffset: Rand, damit das Raster mittig sitzt. */
const centeredOffset = (pageSize: number, count: number, cardSize: number, gap: number): number =>
  Math.max(0, (pageSize - (count * cardSize + Math.max(0, count - 1) * gap)) / 2);

export const computePageLayout = (
  settings: Pick<PdfSettings, 'width' | 'height' | 'hmargin' | 'vmargin'>
    & Partial<Pick<PdfSettings, 'pageLandscape' | 'cardsLandscape' | 'registrationMarks'>>,
): PageLayout => {
  const pageWidth = settings.pageLandscape ? PAGE_HEIGHT_PT : PAGE_WIDTH_PT;
  const pageHeight = settings.pageLandscape ? PAGE_WIDTH_PT : PAGE_HEIGHT_PT;
  const hMargin = (settings.hmargin || 0) * MM_TO_PT;
  const vMargin = (settings.vmargin || 0) * MM_TO_PT;
  // Querliegende Karten belegen einen um 90° gedrehten Platz
  const cardWidth = ((settings.cardsLandscape ? settings.height : settings.width) || 0) * MM_TO_PT;
  const cardHeight = ((settings.cardsLandscape ? settings.width : settings.height) || 0) * MM_TO_PT;

  const fits = cardWidth > 0 && cardHeight > 0;
  const marks = fits && settings.registrationMarks ? registrationGrid(pageWidth, pageHeight, cardWidth, cardHeight, hMargin, vMargin) : null;
  const cardsPerRow = marks ? marks.cols : fits ? cardsThatFit(pageWidth, cardWidth, hMargin) : 0;
  const cardsPerColumn = marks ? marks.rows : fits ? cardsThatFit(pageHeight, cardHeight, vMargin) : 0;
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
    rotated: !!settings.cardsLandscape,
    cardsPerRow,
    cardsPerColumn,
    slots,
    gridMargin: GRID_MARGIN_PT,
    ...(marks && settings.registrationMarks ? { registration: { style: settings.registrationMarks, lengthMm: marks.lengthMm } } : {}),
  };
};

/**
 * Radius der Eckmarken in Punkt wie DocumentGenerator.cornerRadius im Backend: ohne cornerSize AUTO_CORNER_RATIO der Kartenhöhe
 * (der langen Seite, damit querliegende Karten denselben Radius bekommen),
 * sonst cornerSize in mm, höchstens die halbe kürzere Kartenseite.
 */
export const cornerRadius = (cardWidth: number, cardHeight: number, cornerSize?: number | null): number => {
  if (cornerSize == null || cornerSize < 0) {
    return Math.max(cardWidth, cardHeight) * AUTO_CORNER_RATIO;
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
