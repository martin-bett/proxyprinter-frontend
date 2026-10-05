import ApiFactory, { ApiConfig } from '../../../../service/ApiFactory';
import { buildTemplate, isTemplateError } from './requestTemplate';
import { guessJsonFields, guessPaginationLink, pathForRole, rolesAt } from './jsonFields';
import { guessHtmlFields, htmlFieldForRole, htmlFieldValue, listItems, parseHtml } from './htmlFields';
import { detectFormat } from './testRequest';

const scryfall = {
  object: 'list',
  has_more: true,
  next_page: 'https://api.scryfall.com/cards/search?page=2&q=Lightning+Bolt',
  data: [
    {
      name: 'Lightning Bolt',
      lang: 'en',
      set: 'lea',
      collector_number: '161',
      image_uris: {
        small: 'https://cards.scryfall.io/small/front/a.jpg',
        normal: 'https://cards.scryfall.io/normal/front/a.jpg',
        png: 'https://cards.scryfall.io/png/front/a.png',
        art_crop: 'https://cards.scryfall.io/art_crop/front/a.jpg',
      },
      related_uris: { gatherer: 'https://gatherer.wizards.com/x' },
    },
    {
      name: 'Lightning Bolt',
      lang: 'de',
      set: '2x2',
      collector_number: '117',
      image_uris: { png: 'https://cards.scryfall.io/png/front/b.png' },
    },
  ],
};

describe('buildTemplate', () => {
  it('replaces the card name in GET query parameters', () => {
    const t = buildTemplate({ url: 'https://api.scryfall.com/cards/search?q=Lightning+Bolt&unique=prints', method: 'GET', body: '', requestFormat: 'json' }, 'lightning bolt');
    expect(isTemplateError(t)).toBe(false);
    if (isTemplateError(t)) return;
    expect(t.baseUrl).toBe('https://api.scryfall.com/cards/search');
    expect(t.parameterMap.request).toEqual({ q: '{cardname}', unique: 'prints' });
    expect(t.nameParams).toEqual(['q']);
  });

  it('keeps surrounding search syntax', () => {
    const t = buildTemplate({ url: 'https://x.org/s?q=!%22Lightning%20Bolt%22%20lang:any', method: 'GET', body: '', requestFormat: 'json' }, 'Lightning Bolt');
    expect(!isTemplateError(t) && t.parameterMap.request.q).toBe('!"{cardname}" lang:any');
  });

  it('rejects a name in the URL path', () => {
    const t = buildTemplate({ url: 'https://x.org/cards/Lightning%20Bolt', method: 'GET', body: '', requestFormat: 'json' }, 'Lightning Bolt');
    expect(isTemplateError(t) && t.error).toMatch(/path/);
  });

  it('templates JSON and form POST bodies', () => {
    const json = buildTemplate({ url: 'https://x.org/api?x=1', method: 'POST', body: '{"search":"Lightning Bolt","page":1}', requestFormat: 'json' }, 'Lightning Bolt');
    expect(!isTemplateError(json) && json.parameterMap.request).toEqual({ search: '{cardname}', page: '1' });
    expect(!isTemplateError(json) && json.baseUrl).toBe('https://x.org/api?x=1');
    expect(!isTemplateError(json) && json.warnings.length).toBe(1);
    const form = buildTemplate({ url: 'https://x.org/api', method: 'POST', body: 'search=Lightning+Bolt&type=search', requestFormat: 'urlencoded' }, 'Lightning Bolt');
    expect(!isTemplateError(form) && form.parameterMap.request).toEqual({ search: '{cardname}', type: 'search' });
  });

  it('reports a missing name', () => {
    const t = buildTemplate({ url: 'https://x.org/s?q=Shock', method: 'GET', body: '', requestFormat: 'json' }, 'Lightning Bolt');
    expect(isTemplateError(t)).toBe(true);
  });
});

describe('json fields', () => {
  it('guesses list, name, image, language, set and number', () => {
    expect(guessJsonFields(scryfall, 'Lightning Bolt')).toEqual({
      dataListField: 'data',
      nameField: 'name',
      imageUrlField: 'image_uris.png',
      languageField: 'lang',
      setField: 'set',
      setNumberField: 'collector_number',
    });
    expect(guessPaginationLink(scryfall)).toBe('next_page');
  });

  it('handles a top-level array', () => {
    const data = [{ title: 'Pikachu', images: { large: 'https://img.example/p.png' } }];
    expect(guessJsonFields(data, 'Pikachu')).toEqual({ dataListField: '', nameField: 'title', imageUrlField: 'images.large' });
  });

  it('turns clicks into list and relative field paths', () => {
    expect(pathForRole(scryfall, ['data', 1, 'name'], 'dataListField', undefined)).toEqual({ path: 'data' });
    expect(pathForRole(scryfall, ['data', 1, 'image_uris', 'png'], 'imageUrlField', 'data')).toEqual({ path: 'image_uris.png' });
    expect('error' in pathForRole(scryfall, ['next_page'], 'nameField', 'data')).toBe(true);
  });

  it('marks nodes by role', () => {
    const fields = { dataListField: 'data', nameField: 'name' };
    expect(rolesAt(['data'], fields)).toEqual(['dataListField']);
    expect(rolesAt(['data', 1, 'name'], fields)).toEqual(['nameField']);
    expect(rolesAt(['object'], fields)).toEqual([]);
  });
});

const html = `<html><body><div class="header"><img src="/logo.png"></div>
<ul class="results">
  <li class="card-item"><a href="/c/1"><img class="card-img" src="/img/bolt1.png" alt="Lightning Bolt"></a><span class="card-name">Lightning Bolt</span></li>
  <li class="card-item"><a href="/c/2"><img class="card-img" data-src="https://cdn.example/bolt2.png" src="data:image/gif;base64,R0"></a><span class="card-name">Lightning Bolt</span></li>
  <li class="card-item"><a href="/c/3"><img class="card-img" src="/img/shock.png"></a><span class="card-name">Shock</span></li>
</ul></body></html>`;

describe('html fields', () => {
  it('guesses the repeated card container', () => {
    const root = parseHtml(html);
    const guess = guessHtmlFields(root, 'Lightning Bolt');
    expect(guess.dataListField).toBe('li.card-item');
    expect(guess.imageUrlField).toBe('img.card-img | attr:src');
    expect(guess.nameField).toBe('span.card-name | innerText');
  });

  it('uses lazy-load attributes and builds relative selectors from clicks', () => {
    const root = parseHtml(html);
    const items = listItems(root, 'li.card-item');
    const img = items[1].querySelector('img') as any;
    expect(htmlFieldForRole(root, img, 'imageUrlField', 'li.card-item')).toEqual({ path: 'img.card-img | attr:data-src' });
    expect(htmlFieldValue(items[2], 'span.card-name | innerText')).toBe('Shock');
    expect('error' in htmlFieldForRole(root, root.querySelector('div.header img') as any, 'nameField', 'li.card-item')).toBe(true);
  });
});

describe('detectFormat', () => {
  it('detects json and html', () => {
    expect(detectFormat('application/json', '{"a":1}')).toBe('json');
    expect(detectFormat('text/plain', ' [1,2]')).toBe('json');
    expect(detectFormat('text/html', '<html></html>')).toBe('html');
  });
});

describe('ApiFactory.previewResponse', () => {
  const base = {
    id: 0, type: 'api', name: 'test', category: 'MTG', method: 'GET', concurrentLimit: 1,
    parameterMap: { request: { q: '{cardname}' }, url: {} },
  } as const;

  it('reads json results and filters by name', async () => {
    const config = { ...base, baseUrl: 'https://api.scryfall.com/cards/search', dataFormat: 'json', dataListField: 'data', nameField: 'name', imageUrlField: 'image_uris.png', languageField: 'lang' } as unknown as ApiConfig;
    const p = await new ApiFactory({}).previewResponse(config, JSON.stringify(scryfall), 'Lightning Bolt');
    expect(p.all).toHaveLength(2);
    expect(p.matching).toHaveLength(2);
    expect(p.all[1].languageCode).toBe('German');
  });

  it('reads a top-level array without dataListField', async () => {
    const config = { ...base, baseUrl: 'https://x.org', dataFormat: 'json', dataListField: '', nameField: 'n', imageUrlField: 'i' } as unknown as ApiConfig;
    const p = await new ApiFactory({}).previewResponse(config, '[{"n":"Shock","i":"https://x.org/a.png"}]', 'Shock');
    expect(p.matching).toHaveLength(1);
  });

  it('resolves relative html image urls against the base url', async () => {
    const config = { ...base, baseUrl: 'https://shop.example/search', dataFormat: 'html', dataListField: 'li.card-item', nameField: 'span.card-name | innerText', imageUrlField: 'img.card-img | attr:src || img.card-img | attr:data-src' } as unknown as ApiConfig;
    const p = await new ApiFactory({}).previewResponse(config, html, 'Lightning Bolt');
    expect(p.all.map(r => r.imageUrl)).toEqual(['https://shop.example/img/bolt1.png', '', 'https://shop.example/img/shock.png']);
    expect(p.matching).toHaveLength(1);
  });
});
