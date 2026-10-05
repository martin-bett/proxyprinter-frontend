import { canonicalSet, printMatchScore, setCatalogEntries } from './setCatalog';

describe('setCatalog', () => {
  beforeEach(() => setCatalogEntries([
    { code: 'dom', name: 'Dominaria', arena_code: 'dar' },
    { code: 'm10', name: 'Magic 2010' },
    { code: 'con', name: 'Conflux', arena_code: 'conf' },
  ]));

  it('maps codes, Arena codes and names to the same set', () => {
    expect(canonicalSet('DAR')).toBe('dom');
    expect(canonicalSet('Dominaria')).toBe('dom');
    expect(canonicalSet(' DOM ')).toBe('dom');
    expect(canonicalSet('CONF')).toBe('con');
    expect(canonicalSet('SVI')).toBe('svi');
  });

  it('scores set and collector number', () => {
    expect(printMatchScore({ set: 'Magic 2010', setNumber: '146' }, { set: 'M10', number: '146' })).toBe(2);
    expect(printMatchScore({ set: 'm10', setNumber: '0146' }, { set: 'M10', number: '146' })).toBe(2);
    expect(printMatchScore({ set: 'm10', setNumber: '147' }, { set: 'M10', number: '146' })).toBe(1);
    expect(printMatchScore({ set: 'Dominaria' }, { set: 'DAR' })).toBe(1);
    expect(printMatchScore({ set: 'Conflux' }, { set: 'M10' })).toBe(0);
    expect(printMatchScore({}, { set: 'M10' })).toBe(0);
    expect(printMatchScore({ set: 'm10' }, null)).toBe(0);
  });
});
