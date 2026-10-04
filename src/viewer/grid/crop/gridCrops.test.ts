import { areaAspect, centeredAspectPercent, computeGridCrops, percentToPixels } from './gridCrops';

describe('computeGridCrops', () => {
  const area = { x: 0, y: 0, width: 1000, height: 600 };

  it('liefert ohne Raster genau den Ausschnitt', () => {
    expect(computeGridCrops({ x: 10, y: 20, width: 300, height: 400 }, { rows: 1, cols: 1, margin: 0, gap: 0 }))
      .toEqual([{ offSetX: 10, offSetY: 20, width: 300, height: 400, isStretch: true }]);
  });

  it('teilt gleichmäßig ohne Ränder', () => {
    const crops = computeGridCrops(area, { rows: 2, cols: 4, margin: 0, gap: 0 });
    expect(crops).toHaveLength(8);
    expect(crops[0]).toMatchObject({ offSetX: 0, offSetY: 0, width: 250, height: 300 });
    expect(crops[7]).toMatchObject({ offSetX: 750, offSetY: 300, width: 250, height: 300 });
  });

  it('berücksichtigt Außenrand und Abstände', () => {
    const crops = computeGridCrops(area, { rows: 2, cols: 3, margin: 20, gap: 10 });
    // Breite: (1000 - 40 - 20) / 3 = 313, Höhe: (600 - 40 - 10) / 2 = 275
    expect(crops[0]).toMatchObject({ offSetX: 20, offSetY: 20, width: 313, height: 275 });
    expect(crops[1]).toMatchObject({ offSetX: 343, offSetY: 20 });
    expect(crops[5]).toMatchObject({ offSetX: 666, offSetY: 305 });
    // Letzte Kachel endet innerhalb des Außenrands
    expect(crops[5].offSetX! + crops[5].width!).toBeLessThanOrEqual(980);
  });

  it('verschiebt das Raster mit dem Ausschnitt', () => {
    const crops = computeGridCrops({ x: 100, y: 50, width: 200, height: 200 }, { rows: 2, cols: 2, margin: 0, gap: 0 });
    expect(crops[3]).toMatchObject({ offSetX: 200, offSetY: 150, width: 100, height: 100 });
  });

  it('gibt nichts zurück, wenn Rand und Abstände alles auffressen', () => {
    expect(computeGridCrops(area, { rows: 1, cols: 2, margin: 300, gap: 500 })).toEqual([]);
  });
});

describe('Seitenverhältnis', () => {
  it('rechnet das Verhältnis des Ausschnitts aus dem Kachelverhältnis', () => {
    expect(areaAspect(63 / 88, 1, 1)).toBeCloseTo(63 / 88);
    expect(areaAspect(63 / 88, 3, 3)).toBeCloseTo(63 / 88);
    expect(areaAspect(63 / 88, 1, 2)).toBeCloseTo(126 / 88);
  });

  it('zentriert den größten passenden Ausschnitt', () => {
    const wide = centeredAspectPercent(2000, 1000, 1);
    expect(wide).toMatchObject({ x: 25, y: 0, width: 50, height: 100 });
    const tall = centeredAspectPercent(1000, 2000, 1);
    expect(tall).toMatchObject({ x: 0, y: 25, width: 100, height: 50 });
  });

  it('rechnet Prozent in Pixel um und bleibt im Bild', () => {
    expect(percentToPixels({ x: 25, y: 10, width: 50, height: 95 }, 800, 1000))
      .toEqual({ x: 200, y: 100, width: 400, height: 900 });
  });
});
