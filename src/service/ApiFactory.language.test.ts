import ApiFactory, { ApiConfig, GalleryConfig } from './ApiFactory';

jest.mock('./RequestThrottle', () => ({
  throttledFetch: jest.fn(),
}));
// eslint-disable-next-line import/first
import { throttledFetch } from './RequestThrottle';

const apiConfig = (extra: Partial<ApiConfig>): ApiConfig => ({
  id: 1,
  type: 'api',
  name: 'quelle',
  category: 'MTG',
  method: 'GET',
  baseUrl: 'https://example.org/search',
  dataFormat: 'json',
  dataListField: 'data',
  nameField: 'name',
  imageUrlField: 'image',
  concurrentLimit: 1,
  parameterMap: { url: {}, request: {} },
  ...extra,
});

const search = async (config: ApiConfig, data: any[]) => {
  (throttledFetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify({ data }), { status: 200 }));
  const { results } = await new ApiFactory({ quelle: config }).createApi('quelle')({ cardname: 'Sol Ring' });
  return results.map(r => r.languageCode);
};

describe('Default Language', () => {
  afterEach(() => (throttledFetch as jest.Mock).mockReset());

  it('setzt die Default Language, wenn die Quelle keine Sprache liefert', async () => {
    const langs = await search(apiConfig({ defaultLanguage: 'en' }), [{ name: 'Sol Ring', image: 'https://img/a.png' }]);
    expect(langs).toEqual(['English']);
  });

  it('lässt die Sprache leer ohne Default Language', async () => {
    const langs = await search(apiConfig({}), [{ name: 'Sol Ring', image: 'https://img/a.png' }]);
    expect(langs).toEqual([undefined]);
  });

  it('bevorzugt eine gelieferte Sprache und nutzt Englisch nur, wo sie fehlt', async () => {
    const langs = await search(apiConfig({ defaultLanguage: 'en', languageField: 'lang' }), [
      { name: 'Sol Ring', image: 'https://img/a.png', lang: 'de' },
      { name: 'Sol Ring', image: 'https://img/b.png' },
    ]);
    expect(langs).toEqual(['German', 'English']);
  });

  it('setzt die Default Language auch bei Galleries', async () => {
    const gallery: GalleryConfig = {
      id: 2, type: 'gallery', name: 'quelle', category: 'MISC', method: 'GET', baseUrl: 'https://example.org/g',
      dataFormat: 'json', dataListField: 'data', nameField: 'name', imageUrlField: 'image',
      parameterMap: { url: {}, request: {} }, defaultLanguage: 'de',
    };
    (throttledFetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify({ data: [{ name: 'x', image: 'https://img/g.png' }] }), { status: 200 }));
    const { results } = await new ApiFactory({ quelle: gallery }).createApi('quelle')({});
    expect(results.map(r => r.languageCode)).toEqual(['German']);
  });
});
