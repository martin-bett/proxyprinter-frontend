import { SearchResult } from '../service/ApiFactory';
import { collectConnectedCards, dedupeResults } from './connectedCards';

const hit = (name: string, apiName: string, connected?: SearchResult['connectedCards']): SearchResult =>
  ({ name, apiName, imageUrl: `https://img/${apiName}/${name}.png`, connectedCards: connected });

describe('collectConnectedCards', () => {
  it('fasst gleichnamige Karten aus mehreren Deckkarten zusammen', () => {
    const treasure = { name: 'Treasure', typeLine: 'Token Artifact — Treasure', link: 'https://api.scryfall.com/cards/t1' };
    const candidates = collectConnectedCards({
      scryfall: {
        'Smothering Tithe': [hit('Smothering Tithe', 'scryfall', [treasure]), hit('Smothering Tithe', 'scryfall', [{ ...treasure, link: 'https://api.scryfall.com/cards/t2' }])],
        'Dockside Extortionist': [hit('Dockside Extortionist', 'scryfall', [{ name: 'treasure ' }])],
      },
      mtgbuilder: { 'Smothering Tithe': [hit('Smothering Tithe', 'mtgbuilder')] },
    }, ['Smothering Tithe', 'Dockside Extortionist']);

    expect(candidates).toEqual([{
      name: 'Treasure',
      typeLine: 'Token Artifact — Treasure',
      parents: ['Smothering Tithe', 'Dockside Extortionist'],
      links: [{ apiKey: 'scryfall', link: 'https://api.scryfall.com/cards/t1' }],
    }]);
  });

  it('lässt Karten weg, die schon in der Liste stehen', () => {
    const candidates = collectConnectedCards({
      scryfall: { 'Smothering Tithe': [hit('Smothering Tithe', 'scryfall', [{ name: 'Treasure' }, { name: 'Clue' }])] },
    }, ['Smothering Tithe', 'treasure']);

    expect(candidates.map(candidate => candidate.name)).toEqual(['Clue']);
  });
});

describe('dedupeResults', () => {
  it('entfernt gleiche Bilder derselben API', () => {
    const a = hit('Treasure', 'scryfall');
    expect(dedupeResults([a, { ...a }, hit('Treasure', 'mtgbuilder')])).toHaveLength(2);
  });
});
