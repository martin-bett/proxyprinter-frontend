import ApiFactory, { ApiConfig, PageProgress } from './ApiFactory';

jest.mock('./RequestThrottle', () => ({
  throttledFetch: jest.fn(),
}));
// eslint-disable-next-line import/first
import { throttledFetch } from './RequestThrottle';

const config: ApiConfig = {
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
  paginationLinkField: 'next',
  concurrentLimit: 1,
  parameterMap: { url: {}, request: {} },
};

const page = (data: any[], next?: string) => new Response(JSON.stringify({ data, next }), { status: 200 });

describe('Zwischenstand je Seite', () => {
  afterEach(() => (throttledFetch as jest.Mock).mockReset());

  it('meldet nach jeder fertigen Seite Treffer und Requests bisher', async () => {
    (throttledFetch as jest.Mock)
      .mockResolvedValueOnce(page([{ name: 'Sol Ring', image: 'https://img/a.png' }, { name: 'Other', image: 'https://img/x.png' }], 'https://example.org/search?page=2'))
      .mockResolvedValueOnce(page([{ name: 'Sol Ring', image: 'https://img/b.png' }]));
    const progress: PageProgress[] = [];

    const result = await new ApiFactory({ quelle: config }).createApi('quelle')({ cardname: 'Sol Ring' }, p => progress.push(p));

    // Gezählt wird wie im Endergebnis: nur passende Namen
    expect(progress).toEqual([{ count: 1, requestCount: 1 }, { count: 2, requestCount: 2 }]);
    expect(result.results).toHaveLength(2);
    expect(result.requestCount).toBe(2);
  });
});
