import { buildCutDxf, cutFileName } from './cutFile';
import { computePageLayout, cornerRadius, MM_TO_PT } from './pdfLayout';

const layout = computePageLayout({ width: 63.5, height: 88.9, hmargin: 0, vmargin: 0, pageLandscape: true, registrationMarks: 'SILHOUETTE_3' });

/** Gruppencodes und Werte paarweise */
const pairs = (dxf: string) => {
  const lines = dxf.split('\r\n');
  const result: [string, string][] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) result.push([lines[i], lines[i + 1]]);
  return result;
};

describe('buildCutDxf', () => {
  it('writes one closed rounded outline per slot in millimetres', () => {
    const dxf = buildCutDxf(layout, cornerRadius(layout.cardWidth, layout.cardHeight));
    const p = pairs(dxf);
    expect(p.filter(([c, v]) => c === '0' && v === 'POLYLINE')).toHaveLength(8);
    expect(p.filter(([c, v]) => c === '0' && v === 'VERTEX')).toHaveLength(8 * 8);
    expect(p.filter(([c]) => c === '42')).toHaveLength(8 * 4);
    expect(dxf.endsWith('0\r\nEOF\r\n')).toBe(true);

    // Erste Karte links oben: x 21,5 mm, Oberkante 210 - 16,1 mm; Bogen beginnt einen Radius weiter
    const xs = p.filter(([c]) => c === '10').map(([, v]) => Number(v)).filter(v => v > 0);
    const r = cornerRadius(layout.cardWidth, layout.cardHeight) / MM_TO_PT;
    expect(Math.min(...xs)).toBeCloseTo(21.5, 2);
    expect(xs[0]).toBeCloseTo(21.5 + r, 2);
    const ys = p.filter(([c]) => c === '20').map(([, v]) => Number(v)).filter(v => v > 0);
    expect(Math.max(...ys)).toBeCloseTo(210 - 16.1, 2);
  });

  it('writes square outlines without a radius', () => {
    const p = pairs(buildCutDxf(layout, 0));
    expect(p.filter(([c, v]) => c === '0' && v === 'VERTEX')).toHaveLength(8 * 4);
    expect(p.filter(([c]) => c === '42')).toHaveLength(0);
  });

  it('names the page, the card count and the Studio mark settings', () => {
    expect(cutFileName(layout)).toBe('proxyprinter-cut-a4-landscape-8cards-3marks-9mm.dxf');
  });
});
