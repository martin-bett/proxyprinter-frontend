import { act, render, screen } from '@testing-library/react';
import VersionInfo from './VersionInfo';

const respond = (stats: unknown) => {
  global.fetch = jest.fn((url: string) => Promise.resolve(url === '/api/stats'
    ? { ok: true, json: async () => stats }
    : { ok: true, json: async () => ({ build: '20261009-1900' }) })) as any;
};

describe('VersionInfo stats', () => {
  it('shows the counts with thousands separators and plural forms', async () => {
    respond({ sharedSearches: 15152, tempImages: 1, cachedPdfs: 37, decksToday: 12, decksTotal: 1241525, extra: 5 });
    render(<VersionInfo />);

    expect(await screen.findByText('15,152 shared searches')).toBeInTheDocument();
    expect(screen.getByText('1 temp image in cache')).toBeInTheDocument();
    expect(screen.getByText('37 PDFs in cache')).toBeInTheDocument();
    expect(screen.getByText('12 decks created today')).toBeInTheDocument();
    expect(screen.getByText('1,241,525 decks in total')).toBeInTheDocument();
    expect(screen.getByText('Backend 20261009-1900')).toBeInTheDocument();
  });

  it('loads again only when the refresh key changes', async () => {
    respond({ decksToday: 1 });
    const { rerender } = render(<VersionInfo statsRefreshKey={0} />);
    expect(await screen.findByText('1 deck created today')).toBeInTheDocument();

    respond({ decksToday: 2 });
    rerender(<VersionInfo statsRefreshKey={0} />);
    await act(async () => undefined);
    expect(global.fetch).not.toHaveBeenCalled();

    rerender(<VersionInfo statsRefreshKey={1} />);
    expect(await screen.findByText('2 decks created today')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/stats');
  });

  it('shows nothing when the backend has no stats endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as any;
    render(<VersionInfo />);
    await act(async () => undefined);
    expect(screen.queryByText(/in cache|decks/)).not.toBeInTheDocument();
  });
});
