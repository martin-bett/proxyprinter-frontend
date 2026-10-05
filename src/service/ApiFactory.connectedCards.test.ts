import ApiFactory, { ApiConfig } from './ApiFactory';

jest.mock('./RequestThrottle', () => ({
  throttledFetch: jest.fn(),
}));
// eslint-disable-next-line import/first
import { throttledFetch } from './RequestThrottle';

// Ausschnitt der echten Scryfall-Antwort für Smothering Tithe: all_parts enthält die Karte selbst und das Treasure-Token
const tithe = {
  name: 'Smothering Tithe', lang: 'en', set_name: 'Commander Masters', collector_number: '57',
  image_uris: { png: 'https://cards.scryfall.io/png/front/8/tithe.png' },
  all_parts: [
    { object: 'related_card', id: 'da65d83c', component: 'combo_piece', name: 'Smothering Tithe', type_line: 'Enchantment', uri: 'https://api.scryfall.com/cards/da65d83c' },
    { object: 'related_card', id: 'cb7b5024', component: 'token', name: 'Treasure', type_line: 'Token Artifact — Treasure', uri: 'https://api.scryfall.com/cards/cb7b5024' },
  ],
};

const scryfall = (withConnected: boolean): ApiConfig => ({
  id: 8,
  type: 'api',
  name: 'scryfall',
  category: 'MTG',
  method: 'GET',
  baseUrl: 'https://api.scryfall.com/cards/search',
  parameterMap: { request: { q: '{cardname}' }, url: {} },
  concurrentLimit: 5,
  dataFormat: 'json',
  dataListField: 'data',
  nameField: 'name',
  nameSplitCharacter: '//',
  imageUrlField: 'image_uris.png',
  connectedCards: withConnected ? [{ dataListField: 'all_parts', nameField: 'name', linkField: 'uri', typeField: 'type_line' }] : undefined,
});

describe('Verbundene Karten (all_parts)', () => {
  const fetchMock = throttledFetch as jest.Mock;
  afterEach(() => fetchMock.mockReset());

  it('liest die verbundenen Karten aus und lässt die Karte selbst weg', async () => {
    const { matching } = await new ApiFactory({}).previewResponse(scryfall(true), JSON.stringify({ data: [tithe] }), 'Smothering Tithe');

    expect(matching).toHaveLength(1);
    expect(matching[0].connectedCards).toEqual([
      { name: 'Treasure', typeLine: 'Token Artifact — Treasure', link: 'https://api.scryfall.com/cards/cb7b5024' },
    ]);
  });

  it('setzt ein leeres Array, wenn die Liste fehlt, und undefined ohne Locator', async () => {
    const plain = { ...tithe, all_parts: undefined };
    const withLocator = await new ApiFactory({}).previewResponse(scryfall(true), JSON.stringify({ data: [plain] }), 'Smothering Tithe');
    const withoutLocator = await new ApiFactory({}).previewResponse(scryfall(false), JSON.stringify({ data: [tithe] }), 'Smothering Tithe');

    expect(withLocator.matching[0].connectedCards).toEqual([]);
    expect(withoutLocator.matching[0].connectedCards).toBeUndefined();
  });

  it('nimmt Einträge aus mehreren Listen und fasst gleiche Namen zusammen', async () => {
    const config: ApiConfig = {
      ...scryfall(true),
      connectedCards: [
        { dataListField: 'all_parts', nameField: 'name' },
        { dataListField: 'usedTokens', nameField: 'title' },
      ],
    };
    const item = { ...tithe, usedTokens: [{ title: 'Treasure' }, { title: 'Clue' }] };
    const { matching } = await new ApiFactory({}).previewResponse(config, JSON.stringify({ data: [item] }), 'Smothering Tithe');

    expect(matching[0].connectedCards?.map(card => card.name)).toEqual(['Treasure', 'Clue']);
  });

  it('lädt das verlinkte Objekt als einzelnen Treffer', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      name: 'Treasure', lang: 'en', set_name: 'Commander Masters Tokens',
      image_uris: { png: 'https://cards.scryfall.io/png/front/c/treasure.png' },
    }), { status: 200 }));

    const { results } = await new ApiFactory({ scryfall: scryfall(true) })
      .fetchConnectedCard('scryfall', 'https://api.scryfall.com/cards/cb7b5024', 'Treasure');

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.scryfall.com/cards/cb7b5024');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ name: 'Treasure', apiName: 'scryfall', imageUrl: 'https://cards.scryfall.io/png/front/c/treasure.png' });
  });
});
