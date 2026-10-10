import { autoCornerSizeMm, computePageLayout, cornerRadius, gridLinePositions, MM_TO_PT } from './pdfLayout';
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

  it('stays 3 % of the card height without corner size, like the backend default', () => {
    expect(cornerRadius(w, h)).toBeCloseTo(h * 0.03);
    expect(cornerRadius(w, h, null)).toBeCloseTo(h * 0.03);
  });

  it('uses the corner size in mm, capped at half the shorter side', () => {
    expect(cornerRadius(w, h, 3.2)).toBeCloseTo(3.2 * MM_TO_PT);
    expect(cornerRadius(w, h, 100)).toBeCloseTo(w / 2);
  });

  it('shows the automatic size in mm', () => {
    expect(autoCornerSizeMm(88)).toBe(2.6);
  });
});
