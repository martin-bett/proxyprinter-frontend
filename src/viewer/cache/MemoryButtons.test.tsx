import 'fake-indexeddb/auto';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import MemoryButtons from './MemoryButtons';
import { useImageLoaderNumbers } from '../../service/cache/hooks/useImageLoaderNumbers';

jest.mock('../../service/cache/hooks/useImageLoaderNumbers', () => ({
  useImageLoaderNumbers: jest.fn(),
}));

// Echter ImageLoaderService startet im Hintergrund Logik, die nach Testende loggt und Jest scheitern lässt
jest.mock('../../service/cache/ImageLoaderService', () => ({
  imageLoaderService: { cacheLimit: 1024 * 1024 * 1024 },
}));

jest.mock('../../service/cache/hooks/useImageLoaderCache', () => ({
  useImageLoaderCache: () => ({ totalSize: 0 }),
}));

jest.mock('../../service/cache/SearchCacheService', () => ({
  __esModule: true,
  default: { getSearchCount: () => Promise.resolve(0) },
}));

const mockNumbers = useImageLoaderNumbers as jest.Mock;

describe('MemoryButtons Download-Bubbles', () => {
  it('blendet Queue- und Download-Bubbles aus, wenn beide Werte 0 sind', () => {
    mockNumbers.mockReturnValue({ queued: 0, active: 0, cacheLoading: 0 });
    render(<MemoryButtons onResetDeck={() => {}} />);

    expect(screen.queryByTitle('Waiting downloads')).toBeNull();
    expect(screen.queryByTitle('Active downloads')).toBeNull();
    expect(screen.getByTitle('Cache loading queue')).toBeTruthy();
  });

  it('zeigt die Bubbles, sobald etwas wartet oder lädt', () => {
    mockNumbers.mockReturnValue({ queued: 3, active: 0, cacheLoading: 0 });
    render(<MemoryButtons onResetDeck={() => {}} />);

    expect(screen.getByTitle('Waiting downloads').textContent).toContain('3');
    expect(screen.getByTitle('Active downloads').textContent).toContain('0');
  });

  it('blendet die Bubbles nach dem Fade aus, wenn nichts mehr läuft', async () => {
    mockNumbers.mockReturnValue({ queued: 1, active: 0, cacheLoading: 0 });
    const { rerender } = render(<MemoryButtons onResetDeck={() => {}} />);
    expect(screen.getByTitle('Waiting downloads')).toBeTruthy();

    mockNumbers.mockReturnValue({ queued: 0, active: 0, cacheLoading: 0 });
    rerender(<MemoryButtons onResetDeck={() => {}} />);
    // Noch im Fade: das Element bleibt kurz im DOM, ist dann aber weg
    await waitFor(() => expect(screen.queryByTitle('Waiting downloads')).toBeNull(), { timeout: 2000 });
  });
});
