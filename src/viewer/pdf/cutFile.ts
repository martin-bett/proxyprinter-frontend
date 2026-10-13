import { MM_TO_PT, PageLayout } from './pdfLayout';

/** Bulge eines Viertelkreises in einer DXF-Polylinie: tan(90° / 4). */
const QUARTER_BULGE = Math.tan(Math.PI / 8);

const num = (v: number) => (Math.round(v * 1000) / 1000).toString();

/**
 * Schnittdatei für Silhouette Studio: je Platz einer vollen Seite ein Kartenumriss mit abgerundeten Ecken,
 * als DXF (R12) in mm, Ursprung unten links wie im PDF. Das Raster liegt mittig, "Auf Seite zentrieren"
 * in Studio legt die Umrisse also genau auf die gedruckten Karten.
 * radius in Punkt (wie cornerRadius), 0 = eckig.
 */
export const buildCutDxf = (layout: PageLayout, radius: number): string => {
  const lines: string[] = [];
  const add = (code: number, value: string | number) => lines.push(String(code), String(value));
  add(0, 'SECTION'); add(2, 'HEADER');
  add(9, '$ACADVER'); add(1, 'AC1009');
  add(9, '$INSUNITS'); add(70, 4);
  add(0, 'ENDSEC');
  add(0, 'SECTION'); add(2, 'ENTITIES');

  const r = Math.max(0, Math.min(radius, layout.cardWidth / 2, layout.cardHeight / 2)) / MM_TO_PT;
  layout.slots.forEach(slot => {
    const x0 = slot.x / MM_TO_PT;
    const x1 = (slot.x + layout.cardWidth) / MM_TO_PT;
    const y0 = (layout.pageHeight - slot.y - layout.cardHeight) / MM_TO_PT;
    const y1 = (layout.pageHeight - slot.y) / MM_TO_PT;
    // Gegen den Uhrzeigersinn; ein Bulge am Startpunkt eines Bogens macht daraus den Viertelkreis
    const vertices: [number, number, number][] = r > 0
      ? [
        [x0 + r, y0, 0], [x1 - r, y0, QUARTER_BULGE],
        [x1, y0 + r, 0], [x1, y1 - r, QUARTER_BULGE],
        [x1 - r, y1, 0], [x0 + r, y1, QUARTER_BULGE],
        [x0, y1 - r, 0], [x0, y0 + r, QUARTER_BULGE],
      ]
      : [[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]];
    add(0, 'POLYLINE'); add(8, 'CUT'); add(66, 1); add(70, 1);
    add(10, 0); add(20, 0); add(30, 0);
    vertices.forEach(([x, y, bulge]) => {
      add(0, 'VERTEX'); add(8, 'CUT');
      add(10, num(x)); add(20, num(y)); add(30, 0);
      if (bulge) add(42, num(bulge));
    });
    add(0, 'SEQEND'); add(8, 'CUT');
  });

  add(0, 'ENDSEC');
  add(0, 'EOF');
  return lines.join('\r\n') + '\r\n';
};

/** Dateiname mit allem, was in Studio passen muss: Blatt, Kartenzahl, Passmarken. */
export const cutFileName = (layout: PageLayout): string => {
  const orientation = layout.pageWidth > layout.pageHeight ? 'landscape' : 'portrait';
  const marks = layout.registration
    ? `-${layout.registration.style === 'SILHOUETTE_4' ? '4' : '3'}marks-${layout.registration.lengthMm}mm`
    : '';
  return `proxyprinter-cut-a4-${orientation}-${layout.slots.length}cards${marks}.dxf`;
};

export const downloadCutFile = (layout: PageLayout, radius: number) => {
  const blob = new Blob([buildCutDxf(layout, radius)], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cutFileName(layout);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
