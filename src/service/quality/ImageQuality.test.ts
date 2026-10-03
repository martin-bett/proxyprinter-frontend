import { contrast, edgeSharpness, effectiveDpi, rate } from "./ImageQuality";

// Graustufenbild mit vertikalen Streifen (wie Buchstabenstriche), optional weichgezeichnet
function stripes(width: number, height: number, period: number, blurRadius: number): Float32Array {
  const row = new Float32Array(width);
  for (let x = 0; x < width; x++) row[x] = Math.floor(x / period) % 2 === 0 ? 30 : 230;
  let blurred = row;
  for (let pass = 0; pass < blurRadius; pass++) {
    const next = new Float32Array(width);
    for (let x = 0; x < width; x++) {
      const l = blurred[Math.max(0, x - 1)];
      const r = blurred[Math.min(width - 1, x + 1)];
      next[x] = (l + 2 * blurred[x] + r) / 4;
    }
    blurred = next;
  }
  const img = new Float32Array(width * height);
  for (let y = 0; y < height; y++) img.set(blurred, y * width);
  return img;
}

describe("edgeSharpness", () => {
  it("bewertet harte Kanten schärfer als weichgezeichnete", () => {
    const sharp = edgeSharpness(stripes(200, 20, 10, 0), 200, 20).sharpness;
    const soft = edgeSharpness(stripes(200, 20, 10, 2), 200, 20).sharpness;
    const softer = edgeSharpness(stripes(200, 20, 10, 6), 200, 20).sharpness;
    expect(sharp).toBeGreaterThan(soft);
    expect(soft).toBeGreaterThan(softer);
  });

  it("hängt kaum davon ab, wie viel Text im Feld steht", () => {
    const many = edgeSharpness(stripes(400, 20, 10, 2), 400, 20).sharpness;
    const few = edgeSharpness(stripes(400, 20, 100, 2), 400, 20).sharpness;
    expect(Math.abs(many - few) / many).toBeLessThan(0.1);
  });

  it("findet in einer einfarbigen Fläche keine Kanten", () => {
    const flat = new Float32Array(100 * 100).fill(128);
    const result = edgeSharpness(flat, 100, 100);
    expect(result.edgeCoverage).toBe(0);
    expect(contrast(flat)).toBe(0);
  });
});

describe("rate", () => {
  it("ordnet die kalibrierten Schwellen zu", () => {
    expect(rate(1.05, 0.25, 50)).toBe("good");
    expect(rate(0.55, 0.25, 50)).toBe("ok");
    expect(rate(0.2, 0.05, 30)).toBe("poor");
    expect(rate(0, 0, 30)).toBe("poor"); // Text da, aber völlig verwaschen
    expect(rate(0, 0, 2)).toBe("unknown"); // leere Fläche
  });
});

it("rechnet die Druckauflösung auf 63 mm Kartenbreite", () => {
  expect(Math.round(effectiveDpi(745))).toBe(300);
  expect(Math.round(effectiveDpi(488))).toBe(197);
});
