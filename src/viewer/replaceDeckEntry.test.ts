import { CardResult, CardResultsMap } from '../api/types/types';
import { replaceDeckEntry } from './replaceDeckEntry';

const card = (name: string) => ({ name, imageUrl: `${name}.png`, apiName: 'a' } as unknown as CardResult);

describe('replaceDeckEntry', () => {
  it('puts the new card at the old position and keeps the count', () => {
    const deck: CardResultsMap = {
      Bolt: { count: 1, results: [card('Bolt')] },
      Typo: { count: 3, results: [] },
      Island: { count: 2, results: [card('Island')] },
    };
    const next = replaceDeckEntry(deck, 'Typo', { Counterspell: { count: 1, results: [card('Counterspell')] } });
    expect(Object.keys(next)).toEqual(['Bolt', 'Counterspell', 'Island']);
    expect(next.Counterspell.count).toBe(3);
    expect(next.Counterspell.results).toHaveLength(1);
  });

  it('merges with an entry of the same name elsewhere in the deck', () => {
    const deck: CardResultsMap = {
      Island: { count: 2, results: [card('Island')] },
      Typo: { count: 1, results: [] },
    };
    const next = replaceDeckEntry(deck, 'Typo', { Island: { count: 1, results: [card('Island')] } });
    expect(Object.keys(next)).toEqual(['Island']);
    expect(next.Island.count).toBe(3);
  });

  it('keeps the count when the name stays the same', () => {
    const deck: CardResultsMap = { Bolt: { count: 4, results: [] } };
    const next = replaceDeckEntry(deck, 'Bolt', { Bolt: { count: 1, results: [card('Bolt')] } });
    expect(next.Bolt.count).toBe(4);
    expect(next.Bolt.results).toHaveLength(1);
  });

  it('inserts several entries (card faces, crops) in order', () => {
    const deck: CardResultsMap = { A: { count: 1, results: [] }, B: { count: 1, results: [] } };
    const next = replaceDeckEntry(deck, 'A', { X: { count: 1, results: [] }, Y: { count: 1, results: [] } });
    expect(Object.keys(next)).toEqual(['X', 'Y', 'B']);
  });
});
