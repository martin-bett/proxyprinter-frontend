import { centeredAspectPercent, computeGridCrops, percentToPixels } from './gridCrops';

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

describe('Hilfen für den Crop-Rahmen', () => {
  const { clampRect, fitAspectInside, fitDisplaySize, pixelsToPercent } = jest.requireActual('./gridCrops');

  it('hält den Rahmen im Bild', () => {
    expect(clampRect({ x: 900, y: -20, width: 300, height: 2000 }, 1000, 800))
      .toEqual({ x: 700, y: 0, width: 300, height: 800 });
  });

  it('passt das Kartenformat zentriert in den Rahmen ein', () => {
    // Hochformatige Karte 744x1039 hat schon 63:88, der Rahmen bleibt gleich
    const card = fitAspectInside({ x: 0, y: 0, width: 744, height: 1039 }, 63 / 88);
    expect(card.width).toBeCloseTo(744, 0);
    expect(card.height).toBeLessThanOrEqual(1039);
    const wide = fitAspectInside({ x: 0, y: 0, width: 1000, height: 880 }, 63 / 88);
    expect(wide).toMatchObject({ y: 0, height: 880 });
    expect(wide.width).toBeCloseTo(630);
    expect(wide.x).toBeCloseTo(185);
  });

  it('skaliert die Anzeige ohne Verzerrung und ohne Vergrößern', () => {
    // Hochformat: Höhe begrenzt, Breite folgt dem Verhältnis (das war der Fehler mit dem überstehenden Rahmen)
    expect(fitDisplaySize(744, 1039, 900, 600)).toEqual({ width: 429, height: 600 });
    expect(fitDisplaySize(2000, 1000, 500, 600)).toEqual({ width: 500, height: 250 });
    expect(fitDisplaySize(100, 100, 500, 600)).toEqual({ width: 100, height: 100 });
  });

  it('rechnet Pixel in Prozent um', () => {
    expect(pixelsToPercent({ x: 100, y: 50, width: 400, height: 500 }, 1000, 1000))
      .toEqual({ unit: '%', x: 10, y: 5, width: 40, height: 50 });
  });
});
