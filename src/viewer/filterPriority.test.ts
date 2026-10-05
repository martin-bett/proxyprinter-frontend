import { CardResult, CardResultsMap } from '../api/types/types';
import { setCatalogEntries } from '../service/deck/setCatalog';
import { applyOrder, computeSelection, mergeOrder, priorityRank, sortByPriority } from './filterPriority';

const card = (imageUrl: string, languageCode: string, apiName = 'scryfall'): CardResult =>
  ({ name: 'Bolt', imageUrl, languageCode, apiName, cropSettings: {} } as unknown as CardResult);
const languageOf = (c: CardResult) => c.languageCode || 'No Language';

const en = card('en.png', 'en');
const zh = card('zh.png', 'zh');
const de = card('de.png', 'de');
const results: CardResultsMap = { Bolt: { count: 1, results: [en, de, zh] } } as unknown as CardResultsMap;

const select = (prev: any, visible: string[], languageOrder: string[], manual?: CardResult, fresh = false) =>
  computeSelection(prev, {
    cardResults: results,
    manualPicks: manual ? { Bolt: [manual] } : {},
    isVisible: c => visible.includes(languageOf(c)),
    languageOrder,
    apiOrder: [],
    languageOf,
    isFreshPick: () => fresh,
  });

describe('filterPriority', () => {
  it('keeps unseen values in place and appends new ones', () => {
    expect(applyOrder(['zh', 'en'], ['en', 'de', 'zh'])).toEqual(['zh', 'en', 'de']);
    expect(mergeOrder(['zh', 'en', 'de'], ['de', 'en'])).toEqual(['zh', 'de', 'en']);
    expect(mergeOrder([], ['en', 'de'])).toEqual(['en', 'de']);
  });

  it('sorts by language first, then API, then search order', () => {
    const a = card('a', 'en', 'mpc');
    const b = card('b', 'zh', 'mpc');
    const c = card('c', 'zh', 'scryfall');
    expect(sortByPriority([a, b, c], ['zh', 'en'], ['scryfall', 'mpc'], languageOf)).toEqual([c, b, a]);
  });

  it('falls back to the next language when the top one is missing', () => {
    expect(select({}, ['zh', 'en'], ['zh', 'en']).Bolt[0]).toBe(zh);
    const onlyEnglish: CardResultsMap = { Bolt: { count: 1, results: [de, en] } } as unknown as CardResultsMap;
    const selection = computeSelection({}, {
      cardResults: onlyEnglish, manualPicks: {}, isVisible: c => ['zh', 'en'].includes(languageOf(c)),
      languageOrder: ['zh', 'en'], apiOrder: [], languageOf,
    });
    expect(selection.Bolt[0]).toBe(en);
  });

  it('a manual pick wins while it fits and comes back when it fits again', () => {
    let selection = select({}, ['en', 'de'], ['en', 'de'], de);
    expect(selection.Bolt[0]).toBe(de);
    selection = select(selection, ['en'], ['en'], de);
    expect(selection.Bolt[0]).toBe(en);
    selection = select(selection, ['en', 'de'], ['en', 'de'], de);
    expect(selection.Bolt[0]).toBe(de);
  });

  it('a fresh pick stays even if the filter hides it', () => {
    expect(select({}, ['en'], ['en'], zh, true).Bolt[0]).toBe(zh);
    expect(select({}, ['en'], ['en'], zh, false).Bolt[0]).toBe(en);
  });

  it('pre-selects the wanted print per slot, ahead of the language order', () => {
    const m10 = { ...card('m10.png', 'en'), set: 'Magic 2010', setNumber: '146' } as CardResult;
    const m11 = { ...card('m11.png', 'de'), set: 'm11', setNumber: '149' } as CardResult;
    const twoSets = {
      Bolt: { count: 3, results: [zh, m11, m10], wanted: [{ set: 'M10', number: '146' }, null, { set: 'M11' }] },
    } as unknown as CardResultsMap;
    setCatalogEntries([{ code: 'm10', name: 'Magic 2010' }, { code: 'm11', name: 'Magic 2011' }]);
    const selection = computeSelection({}, {
      cardResults: twoSets, manualPicks: {}, isVisible: () => true,
      languageOrder: ['zh', 'de', 'en'], apiOrder: [], languageOf,
    });
    expect(selection.Bolt).toEqual([m10, zh, m11]);
  });

  it('returns the same object when nothing changes', () => {
    const first = select({}, ['en'], ['en']);
    expect(select(first, ['en'], ['en'])).toBe(first);
  });

  it('ranks only checked entries and only when there is a choice', () => {
    expect(priorityRank(['zh', 'en', 'de'], new Set(['zh', 'de']), 'de')).toBe(2);
    expect(priorityRank(['zh', 'en', 'de'], new Set(['zh', 'de']), 'en')).toBeUndefined();
    expect(priorityRank(['zh', 'en'], new Set(['en']), 'en')).toBeUndefined();
  });
});
