import ApiFactory, { GalleryConfig } from './ApiFactory';

jest.mock('./RequestThrottle', () => ({
  throttledFetch: jest.fn(),
}));
// eslint-disable-next-line import/first
import { throttledFetch } from './RequestThrottle';

const galleryConfig = (url: string): GalleryConfig => ({
  id: 1,
  type: 'gallery',
  name: 'reddit',
  category: 'MISC',
  method: 'GET',
  baseUrl: '/api/gallery/source/reddit',
  dataFormat: 'json',
  dataListField: 'images',
  nameField: 'name',
  imageUrlField: 'imageUrl',
  useBackendProxy: false,
  parameterMap: { url: {}, request: { url } },
});

describe('Gallery-Configs mit Backend-Quelle', () => {
  const fetchMock = throttledFetch as jest.Mock;
  afterEach(() => fetchMock.mockReset());

  it('ruft die relative base_url am eigenen Backend mit dem Link auf', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      source: 'reddit',
      images: [
        { name: 'Sol Ring', imageUrl: 'https://i.redd.it/aaa.png' },
        { name: 'Bolt', imageUrl: 'https://i.redd.it/bbb.jpg' },
      ],
    }), { status: 200 }));
    const link = 'https://www.reddit.com/r/magicproxies/s/AbCdEf';
    const api = new ApiFactory({ reddit: galleryConfig(link) }).createApi('reddit');

    const { results } = await api({});

    const requested = new URL(fetchMock.mock.calls[0][0]);
    expect(requested.origin).toBe(window.location.origin);
    expect(requested.pathname).toBe('/api/gallery/source/reddit');
    expect(requested.searchParams.get('url')).toBe(link);
    expect(results.map(r => [r.name, r.imageUrl])).toEqual([
      ['Sol Ring', 'https://i.redd.it/aaa.png'],
      ['Bolt', 'https://i.redd.it/bbb.jpg'],
    ]);
  });

  it('gibt die Fehlermeldung des Backends weiter', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'Reddit hat den Abruf abgelehnt (403).' }), { status: 502 }));
    const api = new ApiFactory({ reddit: galleryConfig('x') }).createApi('reddit');

    await expect(api({})).rejects.toThrow('Reddit hat den Abruf abgelehnt (403).');
  });
});
