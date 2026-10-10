import { computePageLayout, gridLinePositions } from './pdfLayout';
import { cropRect } from './PdfPagePreview';

describe('computePageLayout', () => {
  it('fits 3 x 3 standard cards on A4 like the backend', () => {
    const layout = computePageLayout({ width: 63, height: 88, hmargin: 0, vmargin: 0 });
    expect(layout.cardsPerRow).toBe(3);
    expect(layout.cardsPerColumn).toBe(3);
    expect(layout.slots).toHaveLength(9);
    expect(layout.slots[0].x).toBeCloseTo(28.3);
    expect(layout.slots[1].x - layout.slots[0].x).toBeCloseTo(63 * 2.83);
  });

  it('reduces the grid when margins grow', () => {
    const layout = computePageLayout({ width: 63, height: 88, hmargin: 15, vmargin: 15 });
    expect(layout.cardsPerRow).toBe(2);
  });

  it('fits 4 x 2 upright cards on landscape A4 like the backend', () => {
    const layout = computePageLayout({ width: 63, height: 88, hmargin: 0, vmargin: 0, pageLandscape: true });
    expect(layout.pageWidth).toBeGreaterThan(layout.pageHeight);
    expect(layout.cardsPerRow).toBe(4);
    expect(layout.cardsPerColumn).toBe(2);
    expect(layout.cardWidth).toBeCloseTo(63 * 2.83);
  });

  it('turns the card slot for landscape cards', () => {
    const portraitPage = computePageLayout({ width: 63, height: 88, hmargin: 0, vmargin: 0, cardsLandscape: true });
    expect(portraitPage.rotated).toBe(true);
    expect(portraitPage.cardWidth).toBeCloseTo(88 * 2.83);
    expect(portraitPage.cardHeight).toBeCloseTo(63 * 2.83);
    expect([portraitPage.cardsPerRow, portraitPage.cardsPerColumn]).toEqual([2, 4]);

    const landscapePage = computePageLayout({ width: 63, height: 88, hmargin: 0, vmargin: 0, pageLandscape: true, cardsLandscape: true });
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
