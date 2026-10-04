import { estimateCardBytes, estimatePdfBytes, PNG_BYTES_PER_PIXEL } from './pdfSizeLimit';
import { defaultSettings } from './SettingsDialog';

const settings = { ...defaultSettings, width: 63, height: 88, maxDpi: 300 };
const maxPixels = Math.floor((63 * 300) / 25.4) * Math.floor((88 * 300) / 25.4);

describe('pdfSizeLimit', () => {
  it('nimmt für ungeladene Bilder die maximale Auflösung an', () => {
    expect(estimateCardBytes({ imageUrl: 'a' }, settings)).toBeCloseTo(maxPixels * PNG_BYTES_PER_PIXEL);
  });

  it('rechnet kleine Bilder mit ihren eigenen Pixeln', () => {
    const bytes = estimateCardBytes({ imageUrl: 'a', imageInfo: { width: 488, height: 680 } }, settings);
    expect(bytes).toBeCloseTo(488 * 680 * PNG_BYTES_PER_PIXEL);
  });

  it('skaliert große Bilder wie das Backend auf maxDpi herunter', () => {
    const bytes = estimateCardBytes({ imageUrl: 'a', imageInfo: { width: 3000, height: 4200 } }, settings);
    expect(bytes).toBeLessThanOrEqual(maxPixels * PNG_BYTES_PER_PIXEL);
  });

  it('nutzt den Zuschnitt statt der Bildgröße', () => {
    const bytes = estimateCardBytes(
      { imageUrl: 'a', imageInfo: { width: 700, height: 1000 }, cropSettings: { width: 100, height: 100, isStretch: true } },
      settings
    );
    expect(bytes).toBeCloseTo(100 * 100 * PNG_BYTES_PER_PIXEL);
  });

  it('zählt jede Kopie einzeln', () => {
    const entry = { imageUrl: 'a', imageInfo: { width: 100, height: 100 } };
    expect(estimatePdfBytes([entry, entry, entry], settings)).toBeCloseTo(3 * 100 * 100 * PNG_BYTES_PER_PIXEL);
  });
});
