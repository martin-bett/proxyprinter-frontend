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
    expect(Object.keys(other).sort()).toEqual(Object.keys(base).sort());
    Object.keys(base).forEach(key => expect([key, placeholders(other[key])]).toEqual([key, placeholders(base[key])]));
  });
});
