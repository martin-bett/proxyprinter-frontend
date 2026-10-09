import fs from 'fs';
import path from 'path';
import en from './locales/en.json';

const dir = path.join(__dirname, 'locales');
const flatten = (obj: Record<string, unknown>, prefix = ''): Record<string, string> =>
  Object.entries(obj).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null
      ? { ...acc, ...flatten(v as Record<string, unknown>, key) }
      : { ...acc, [key]: String(v) };
  }, {});
// Plural variants differ per language (ru has few/many, ja/zh only other), so compare the base keys.
const PLURAL = /_(zero|one|two|few|many|other)$/;
const baseKeys = (keys: string[]) => Array.from(new Set(keys.map(k => k.replace(PLURAL, '')))).sort();
const placeholders = (s: string) => (s.match(/{{\s*\w+\s*}}/g) ?? []).map(p => p.replace(/\s/g, '')).sort();

describe('locales', () => {
  const base = flatten(en);
  const others = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'en.json');

  it('en.json has no empty texts', () => {
    Object.entries(base).forEach(([key, text]) => expect([key, text.trim() !== '']).toEqual([key, true]));
  });

  it.each(others.length ? others : [null])('%s has the same keys and placeholders as en.json', file => {
    if (!file) return;
    const other = flatten(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
    expect(baseKeys(Object.keys(other))).toEqual(baseKeys(Object.keys(base)));
    Object.keys(base).forEach(key => {
      const variant = other[key] ?? other[key.replace(PLURAL, '_other')];
      expect(variant).toBeDefined();
      // {{count}} may be dropped in a singular variant ("a card"), so only compare non-plural keys strictly
      if (!PLURAL.test(key)) expect([key, placeholders(variant)]).toEqual([key, placeholders(base[key])]);
    });
  });
});

describe('detectLanguage', () => {
  const setBrowser = (languages: string[]) =>
    Object.defineProperty(window.navigator, 'languages', { value: languages, configurable: true });
  afterEach(() => localStorage.clear());

  it('uses the saved choice first, then the browser language, then English', async () => {
    const { detectLanguage } = await import('./index');
    setBrowser(['xx-XX', 'de-AT', 'fr']);
    expect(detectLanguage()).toBe('de');
    localStorage.setItem('uiLanguage', 'ja');
    expect(detectLanguage()).toBe('ja');
    localStorage.clear();
    setBrowser(['xx']);
    expect(detectLanguage()).toBe('en');
  });
});
