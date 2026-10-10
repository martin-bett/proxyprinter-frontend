import { AUTO_CORNER_RATIO, autoCornerSizeMm, computePageLayout, cornerRadius, gridLinePositions, MM_TO_PT } from './pdfLayout';
import { cornerEdgeColors, cropRect, rotateCornerColors } from './PdfPagePreview';

describe('computePageLayout', () => {
  it('fits 3 x 3 real-size cards centered on A4 like the backend', () => {
    const layout = computePageLayout({ width: 63.5, height: 88.9, hmargin: 0, vmargin: 0 });
    expect(MM_TO_PT * 25.4).toBeCloseTo(72);
    expect(layout.cardsPerRow).toBe(3);
    expect(layout.cardsPerColumn).toBe(3);
    expect(layout.slots).toHaveLength(9);
    // (210 - 3 * 63,5) / 2 = 9,75 mm, (297 - 3 * 88,9) / 2 = 15,15 mm
    expect(layout.slots[0].x / MM_TO_PT).toBeCloseTo(9.75, 1);
    expect(layout.slots[0].y / MM_TO_PT).toBeCloseTo(15.15, 1);
    expect(layout.slots[1].x - layout.slots[0].x).toBeCloseTo(63.5 * MM_TO_PT);
  });

  it('fits 4 x 2 upright cards on landscape A4', () => {
    const layout = computePageLayout({ width: 63.5, height: 88.9, hmargin: 0, vmargin: 0, pageLandscape: true });
    expect(layout.pageWidth).toBeGreaterThan(layout.pageHeight);
    expect(layout.cardsPerRow).toBe(4);
    expect(layout.cardsPerColumn).toBe(2);
  });

  it('reduces the grid when margins grow', () => {
    const layout = computePageLayout({ width: 63, height: 88, hmargin: 15, vmargin: 15 });
    expect(layout.cardsPerRow).toBe(2);
  });

  it('turns the card slot for landscape cards', () => {
    const portraitPage = computePageLayout({ width: 63.5, height: 88.9, hmargin: 0, vmargin: 0, cardsLandscape: true });
    expect(portraitPage.rotated).toBe(true);
    expect(portraitPage.cardWidth).toBeCloseTo(88.9 * MM_TO_PT);
    expect(portraitPage.cardHeight).toBeCloseTo(63.5 * MM_TO_PT);
    expect([portraitPage.cardsPerRow, portraitPage.cardsPerColumn]).toEqual([2, 4]);

    const landscapePage = computePageLayout({ width: 63.5, height: 88.9, hmargin: 0, vmargin: 0, pageLandscape: true, cardsLandscape: true });
    expect([landscapePage.cardsPerRow, landscapePage.cardsPerColumn]).toEqual([3, 3]);
  });

  it('returns no slots for oversized cards', () => {
    expect(computePageLayout({ width: 200, height: 300, hmargin: 0, vmargin: 0 }).slots).toHaveLength(0);
  });
});

describe('gridLinePositions', () => {
  it('adds the page-edge lines around the card edges', () => {
    const layout = computePageLayout({ width: 63, height: 88, hmargin: 0, vmargin: 0 });
    const { vertical } = gridLinePositions(layout, 9);
    expect(vertical).toHaveLength(6); // 4 Kartenkanten + 2 Seitenränder
  });
});

describe('cropRect', () => {
  it('uses the whole image without crop settings', () => {
    expect(cropRect(100, 200)).toEqual({ x: 0, y: 0, w: 100, h: 200 });
  });
  it('clamps the crop to the image', () => {
    expect(cropRect(100, 200, { offSetX: 10, offSetY: 20, width: 500, height: 100, isStretch: false }))
      .toEqual({ x: 10, y: 20, w: 90, h: 100 });
  });
});

describe('cornerRadius', () => {
  const w = 63 * MM_TO_PT;
  const h = 88 * MM_TO_PT;

  it('is 1/8 inch on real card size without corner size, like the backend default', () => {
    expect(cornerRadius(w, h)).toBeCloseTo(h * AUTO_CORNER_RATIO);
    expect(cornerRadius(w, h, null)).toBeCloseTo(h * AUTO_CORNER_RATIO);
    expect(cornerRadius(63.5 * MM_TO_PT, 88.9 * MM_TO_PT)).toBeCloseTo(3.175 * MM_TO_PT);
  });

  it('uses the corner size in mm, capped at half the shorter side', () => {
    expect(cornerRadius(w, h, 3.2)).toBeCloseTo(3.2 * MM_TO_PT);
    expect(cornerRadius(w, h, 100)).toBeCloseTo(w / 2);
  });

  it('shows the automatic size in mm', () => {
    expect(autoCornerSizeMm(88)).toBe(3.1);
  });
});

describe('cornerEdgeColors', () => {
  // 100 x 140 px, 4 px Rahmen: oben/unten rot, links/rechts blau (in den Ecken), innen grau
  const read = (x: number, y: number): [number, number, number, number] => {
    if (x < 4 || x >= 96) return [0, 0, 255, 255];
    if (y < 4 || y >= 136) return [255, 0, 0, 255];
    return [128, 128, 128, 255];
  };

  it('measures both edges of each corner like the backend', () => {
    const colors = cornerEdgeColors(read, { x: 0, y: 0, w: 100, h: 140 }, 0.1, 0.1);
    expect(colors).toHaveLength(4);
    colors.forEach(([horizontal, vertical]) => {
      expect(horizontal).toEqual([255, 0, 0]);
      expect(vertical).toEqual([0, 0, 255]);
    });
  });

  it('falls back to the average border color for transparent pixels', () => {
    const transparent = (): [number, number, number, number] => [10, 20, 30, 0];
    const [[horizontal, vertical]] = cornerEdgeColors(transparent, { x: 0, y: 0, w: 100, h: 140 }, 0.1, 0.1);
    expect(horizontal).toEqual([10, 20, 30]);
    expect(vertical).toEqual([10, 20, 30]);
  });
});

describe('rotateCornerColors', () => {
  it('moves each corner one step clockwise and swaps its edges', () => {
    const c = (n: number): [number, number, number] => [n, n, n];
    // Reihenfolge wie drawCorners: links oben, rechts oben, links unten, rechts unten; je [waagerecht, senkrecht]
    const upright = [[c(1), c(2)], [c(3), c(4)], [c(5), c(6)], [c(7), c(8)]] as [[number, number, number], [number, number, number]][];
    const rotated = rotateCornerColors(upright);
    expect(rotated[1]).toEqual([c(2), c(1)]); // links oben -> rechts oben
    expect(rotated[3]).toEqual([c(4), c(3)]); // rechts oben -> rechts unten
    expect(rotated[2]).toEqual([c(8), c(7)]); // rechts unten -> links unten
    expect(rotated[0]).toEqual([c(6), c(5)]); // links unten -> links oben
  });
});
