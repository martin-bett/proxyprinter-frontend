import serverSearchCache, { configHash, configKey, lookupKey } from './ServerSearchCache';
import { Config } from '../ApiFactory';

const config = (overrides: Partial<Record<string, unknown>> = {}): Config => ({
  id: 7, type: 'api', name: 'scryfall', category: 'mtg', method: 'GET', baseUrl: 'https://api.scryfall.com/cards/search',
  dataFormat: 'json', dataListField: 'data', nameField: 'name', imageUrlField: 'image_uris.png', concurrentLimit: 2,
  ...overrides,
} as unknown as Config);

const result = (name: string) => ({ results: [{ name, apiName: 'scryfall', imageUrl: `https://img/${name}.png` }], rawResponse: '{}', requestCount: 1 });

describe('ServerSearchCache', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
  });

  it('hashes only settings that change the result', () => {
    const base = configHash(config());
    expect(configHash(config({ averageRating: 4, published: true, concurrentLimit: 9 }))).toBe(base);
    expect(configHash(config({ defaultLanguage: 'de' }))).not.toBe(base);
    expect(configHash(config({ imageUrlField: 'image_uris.large' }))).not.toBe(base);
    // Reihenfolge der Felder egal
    const reordered = Object.fromEntries(Object.entries(config()).reverse()) as unknown as Config;
    expect(configHash(reordered)).toBe(base);
    expect(configKey(config())).toBe('7');
  });

  it('maps server hits back to api key and search term', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const { entries } = JSON.parse(init.body as string);
      expect(entries).toHaveLength(2);
      return { ok: true, json: async () => ({ hits: [{ ...entries[0], term: 'lightning bolt', createdAt: 1, result: result('Lightning Bolt') }] }) };
    });
    const hits = await serverSearchCache.lookup([
      { apiKey: 'scryfall', config: config(), term: 'Lightning Bolt' },
      { apiKey: 'scryfall', config: config(), term: 'Shock' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/api/search-cache/lookup', expect.objectContaining({ method: 'POST' }));
    expect(hits.get(lookupKey('scryfall', 'Lightning Bolt'))?.results[0].name).toBe('Lightning Bolt');
    expect(hits.has(lookupKey('scryfall', 'Shock'))).toBe(false);
  });

  it('treats an unreachable backend as no hits', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const hits = await serverSearchCache.lookup([{ apiKey: 'scryfall', config: config(), term: 'Shock' }]);
    expect(hits.size).toBe(0);
  });

  it('sends non-empty results in batches and skips empty ones', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ stored: 1 }) });
    for (let i = 0; i < 60; i++) serverSearchCache.put(config(), `Card ${i}`, result(`Card ${i}`));
    serverSearchCache.put(config(), 'Nothing', { results: [], rawResponse: '' });
    await serverSearchCache.flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const bodies = fetchMock.mock.calls.map(call => JSON.parse(call[1].body));
    expect(bodies[0].entries).toHaveLength(50);
    expect(bodies[1].entries).toHaveLength(10);
    expect(bodies[0].entries[0]).toMatchObject({ config: '7', term: 'Card 0' });
    expect(bodies[0].entries[0].result.requestCount).toBeUndefined();
  });
});
