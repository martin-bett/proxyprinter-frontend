import ApiFactory, { GalleryConfig } from './ApiFactory';

jest.mock('./RequestThrottle', () => ({
  throttledFetch: jest.fn(),
}));
// eslint-disable-next-line import/first
import { throttledFetch } from './RequestThrottle';

const base = (over: Partial<GalleryConfig>): GalleryConfig => ({
  id: 7,
  type: 'gallery',
  name: 'gallery',
  category: 'MISC',
  method: 'GET',
  baseUrl: 'https://example.com/{id}',
  dataFormat: 'json',
  dataListField: '',
  nameField: '',
  imageUrlField: '',
  useBackendProxy: false,
  parameterMap: { url: {}, request: {} },
  ...over,
});

// wie in der Migration 2026-10-06_gallery_generic.sql
const redditConfig = (link: string): GalleryConfig => base({
  name: 'reddit',
  baseUrl: 'https://www.reddit.com/comments/{id}.json?raw_json=1&limit=1',
  linkPattern: '(?:/comments/|/gallery/|redd\\.it/)(?<id>[a-z0-9]{4,12})(?:[/?#]|$)',
  followInputRedirects: true,
  credential: 'reddit',
  dataListField: '0.data.children.0.data.media_metadata',
  nameField: 'id',
  imageUrlField: 's.u',
  imageUrlPattern: '^https://(?:preview|external-preview)\\.redd\\.it/([^?]+).*$',
  imageUrlReplacement: 'https://i.redd.it/$1',
  parameterMap: { url: {}, request: { url: link } },
});

const driveConfig = (link: string): GalleryConfig => base({
  name: 'google_drive',
  baseUrl: 'https://drive.google.com/embeddedfolderview?id={id}',
  linkPattern: '(?:/folders/|[?&]id=)(?<id>[A-Za-z0-9_-]{10,})',
  dataFormat: 'html',
  dataListField: 'div.flip-entry:not(:has(a[href*="/folders/"]))',
  nameField: '.flip-entry-title | innerText',
  imageUrlField: 'a[href] | attr:href',
  imageUrlPattern: '^.*/file/d/([A-Za-z0-9_-]+).*$',
  imageUrlReplacement: 'https://drive.google.com/uc?export=download&id=$1',
  namePattern: '\\.[A-Za-z0-9]{2,5}$',
  nameReplacement: '',
  parameterMap: { url: {}, request: { url: link } },
});

const FOLDER_HTML = `
<div class="flip-entries">
  <div class="flip-entry" id="entry-1FileAaaaaaaaaa"><a href="https://drive.google.com/file/d/1FileAaaaaaaaaa/view?usp=drive_web">
    <div class="flip-entry-info"><div class="flip-entry-title">Sol Ring.png</div></div></a></div>
  <div class="flip-entry" id="entry-1Subfolderbbbbb"><a href="https://drive.google.com/drive/folders/1Subfolderbbbbb">
    <div class="flip-entry-info"><div class="flip-entry-title">Tokens</div></div></a></div>
  <div class="flip-entry" id="entry-1Fileddddddddd"><a href="https://drive.google.com/file/d/1Fileddddddddd/view?usp=drive_web">
    <div class="flip-entry-info"><div class="flip-entry-title">Lightning Bolt.JPG</div></div></a></div>
</div>`;

describe('Gallery-Configs über das Backend', () => {
  const fetchMock = throttledFetch as jest.Mock;
  afterEach(() => fetchMock.mockReset());

  it('ruft das Backend mit dem Link auf und liest Reddit-Galerien aus media_metadata', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{ data: { children: [{ data: { media_metadata: {
      aaa: { status: 'valid', e: 'Image', id: 'aaa', s: { u: 'https://preview.redd.it/aaa.png?width=640&format=png&auto=webp&s=sig' } },
      bbb: { status: 'valid', e: 'AnimatedImage', id: 'bbb', s: { gif: 'https://i.redd.it/bbb.gif' } },
      ccc: { status: 'valid', e: 'Image', id: 'ccc', s: { u: 'https://preview.redd.it/ccc.jpg?width=640&s=sig' } },
    } } }] } }, {}]), { status: 200 }));
    const link = 'https://www.reddit.com/r/magicproxies/s/AbCdEf';
    const api = new ApiFactory({ reddit: redditConfig(link) }).createApi('reddit');

    const { results } = await api({});

    const requested = new URL(fetchMock.mock.calls[0][0]);
    expect(requested.pathname).toBe('/api/gallery/7/fetch');
    expect(requested.searchParams.get('input')).toBe(link);
    expect(results.map(r => [r.name, r.imageUrl])).toEqual([
      ['aaa', 'https://i.redd.it/aaa.png'],
      ['ccc', 'https://i.redd.it/ccc.jpg'],
    ]);
  });

  it('liest Drive-Ordner aus dem HTML, überspringt Unterordner und entfernt die Endung', async () => {
    fetchMock.mockResolvedValue(new Response(FOLDER_HTML, { status: 200 }));
    const api = new ApiFactory({ drive: driveConfig('https://drive.google.com/drive/folders/1FolderXyzXyzXyz') }).createApi('drive');

    const { results } = await api({});

    expect(results.map(r => [r.name, r.imageUrl])).toEqual([
      ['Sol Ring', 'https://drive.google.com/uc?export=download&id=1FileAaaaaaaaaa'],
      ['Lightning Bolt', 'https://drive.google.com/uc?export=download&id=1Fileddddddddd'],
    ]);
  });

  it('gibt die Fehlermeldung des Backends weiter', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'reddit.com blockt den Abruf (HTTP 403).' }), { status: 502 }));
    const api = new ApiFactory({ reddit: redditConfig('x') }).createApi('reddit');

    await expect(api({})).rejects.toThrow('reddit.com blockt den Abruf (HTTP 403).');
  });

  it('führt Configs ohne Parameter und ohne Link-Pattern direkt aus', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ cards: [{ n: 'A', u: 'https://x.test/a.png' }] }), { status: 200 }));
    const config = base({ baseUrl: 'https://x.test/list.json', dataListField: 'cards', nameField: 'n', imageUrlField: 'u' });
    const api = new ApiFactory({ g: config }).createApi('g');

    const { results } = await api({});

    expect(String(fetchMock.mock.calls[0][0])).toBe('https://x.test/list.json');
    expect(results.map(r => r.imageUrl)).toEqual(['https://x.test/a.png']);
  });
});
