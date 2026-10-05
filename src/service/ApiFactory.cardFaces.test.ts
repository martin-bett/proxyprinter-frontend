import ApiFactory, { ApiConfig } from './ApiFactory';

jest.mock('./RequestThrottle', () => ({
  throttledFetch: jest.fn(),
}));
// eslint-disable-next-line import/first
import { throttledFetch } from './RequestThrottle';

// Ausschnitt einer Scryfall-Antwort: Transform-Karte ohne image_uris oben, Split-Karte mit image_uris oben
const scryfallResponse = {
  data: [
    {
      name: 'Delver of Secrets // Insectile Aberration', lang: 'en', set_name: 'Innistrad', collector_number: '51',
      card_faces: [
        { name: 'Delver of Secrets', image_uris: { png: 'https://cards.scryfall.io/png/front/d/delver.png' } },
        { name: 'Insectile Aberration', image_uris: { png: 'https://cards.scryfall.io/png/back/d/delver.png' } },
      ],
    },
    {
      name: 'Fire // Ice', lang: 'en', set_name: 'Apocalypse', collector_number: '128',
      image_uris: { png: 'https://cards.scryfall.io/png/front/f/fire-ice.png' },
      card_faces: [{ name: 'Fire' }, { name: 'Ice' }],
    },
  ],
};

const scryfall = (withFaces: boolean): ApiConfig => ({
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
  languageField: 'lang',
  setField: 'set_name',
  ...(withFaces ? { cardFacesDataListField: 'card_faces', cardFacesImageUrlField: 'image_uris.png', cardFacesNameField: 'name' } : {}),
});

describe('Mehrseitige Karten', () => {
  const fetchMock = throttledFetch as jest.Mock;
  beforeEach(() => fetchMock.mockImplementation(async () => new Response(JSON.stringify(scryfallResponse), { status: 200 })));
  afterEach(() => fetchMock.mockReset());

  it('ohne card_faces-Felder fällt die Transform-Karte heraus (bisheriges Verhalten)', async () => {
    const { results } = await new ApiFactory({ scryfall: scryfall(false) }).createApi('scryfall')({ cardname: 'Delver of Secrets' });
    expect(results).toEqual([]);
  });

  it('liefert jede Seite mit Bild als eigenen Treffer', async () => {
    const { results } = await new ApiFactory({ scryfall: scryfall(true) }).createApi('scryfall')({ cardname: 'Delver of Secrets' });
    expect(results.map(r => [r.faceName, r.imageUrl])).toEqual([
      ['Delver of Secrets', 'https://cards.scryfall.io/png/front/d/delver.png'],
      ['Insectile Aberration', 'https://cards.scryfall.io/png/back/d/delver.png'],
    ]);
    expect(results[0].name).toBe('Delver of Secrets // Insectile Aberration');
    expect(results[0].set).toBe('Innistrad');
  });

  it('findet die Karte auch über den Namen der Rückseite', async () => {
    const { results } = await new ApiFactory({ scryfall: scryfall(true) }).createApi('scryfall')({ cardname: 'Insectile Aberration' });
    expect(results).toHaveLength(2);
  });

  it('Seiten ohne eigenes Bild ändern nichts, das Bild der ganzen Karte bleibt', async () => {
    const { results } = await new ApiFactory({ scryfall: scryfall(true) }).createApi('scryfall')({ cardname: 'Fire' });
    expect(results.map(r => [r.faceName, r.imageUrl])).toEqual([[undefined, 'https://cards.scryfall.io/png/front/f/fire-ice.png']]);
  });
});
