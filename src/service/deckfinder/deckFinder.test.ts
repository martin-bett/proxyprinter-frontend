import { DeckFinderConfig, extractDeck, extractSearchHits, matchDeckLink, valuesAtPath } from './deckFinder';

const archidekt: DeckFinderConfig = {
  id: 1, name: 'archidekt', category: 'MTG',
  linkPattern: 'archidekt\\.com/(?:api/)?decks/(?<id>\\d+)', fetchUrl: 'https://archidekt.com/api/decks/{id}/', dataFormat: 'json',
  deckNameField: 'name', entryListFields: 'cards', quantityField: 'quantity', nameField: 'card.oracleCard.name',
  setField: 'card.edition.editioncode', numberField: 'card.collectorNumber', boardField: 'categories', optionalBoards: 'Sideboard, Maybeboard',
  searchUrl: 'https://archidekt.com/api/decks/v3/?name={query}&page={page}', searchListField: 'results', searchIdField: 'id',
  searchNameField: 'name', searchOwnerField: 'owner.username', searchImageField: 'featured', searchInfoField: 'size',
};

const edhrec: DeckFinderConfig = {
  id: 3, name: 'edhrec_average', category: 'MTG', linkPattern: 'edhrec\\.com/(?:average-decks|commanders)/(?<id>[a-z0-9-]+)',
  fetchUrl: 'https://json.edhrec.com/pages/average-decks/{id}.json', dataFormat: 'json', deckNameField: 'header',
  entryListFields: 'deck.commander_v2, deck.cards.*', quantityField: '1', nameField: '0',
};

const tappedout: DeckFinderConfig = {
  id: 2, name: 'tappedout', category: 'MTG', linkPattern: 'tappedout\\.net/mtg-decks/(?<id>[\\w-]+)',
  fetchUrl: 'https://tappedout.net/mtg-decks/{id}/?fmt=txt', dataFormat: 'text', optionalBoards: 'Sideboard, Maybeboard',
};

const archidektBody = JSON.stringify({
  name: 'Atraxa cool phyrexians',
  categories: [{ name: 'Maybeboard', includedInDeck: false }],
  cards: [
    { quantity: 1, categories: ['Commander'], card: { oracleCard: { name: "Atraxa, Praetors' Voice" }, edition: { editioncode: 'c16' }, collectorNumber: '28' } },
    { quantity: 1, categories: ['Ramp'], card: { oracleCard: { name: 'Sol Ring' }, edition: { editioncode: 'cmm' }, collectorNumber: '410' } },
    { quantity: 7, categories: [], card: { oracleCard: { name: 'Forest' }, edition: {}, collectorNumber: '280' } },
    { quantity: 1, categories: ['Ramp', 'Maybeboard'], card: { oracleCard: { name: 'Arcane Signet' }, edition: { editioncode: 'cmr' } } },
    { quantity: 2, categories: ['Sideboard'], card: { oracleCard: { name: 'Duress' }, edition: { editioncode: 'm19' } } },
  ],
});

describe('valuesAtPath', () => {
  it('follows dots, indexes and wildcards', () => {
    const data = { a: { x: [1, 2], y: [3] }, b: [{ n: 'p' }, { n: 'q' }] };
    expect(valuesAtPath(data, 'a.x')).toEqual([[1, 2]]);
    expect(valuesAtPath(data, 'a.*')).toEqual([[1, 2], [3]]);
    expect(valuesAtPath(data, 'b.*.n')).toEqual(['p', 'q']);
    expect(valuesAtPath(data, 'b.1.n')).toEqual(['q']);
    expect(valuesAtPath(data, 'missing.path')).toEqual([]);
  });
});

describe('matchDeckLink', () => {
  const configs = [archidekt, tappedout, edhrec];
  it('finds the source of a pasted link', () => {
    expect(matchDeckLink(configs, ' https://archidekt.com/decks/1363300/commander ')?.name).toBe('archidekt');
    expect(matchDeckLink(configs, 'https://tappedout.net/mtg-decks/atraxa-superfriends/')?.name).toBe('tappedout');
    expect(matchDeckLink(configs, 'https://edhrec.com/commanders/atraxa-praetors-voice')?.name).toBe('edhrec_average');
  });
  it('ignores decklists and unknown links', () => {
    expect(matchDeckLink(configs, '1 Sol Ring\n1 Forest')).toBeNull();
    expect(matchDeckLink(configs, 'https://www.moxfield.com/decks/abc')).toBeNull();
    expect(matchDeckLink([{ ...archidekt, linkPattern: '(' }], 'https://archidekt.com/decks/1')).toBeNull();
  });
});

describe('extractDeck', () => {
  it('reads archidekt json and leaves optional boards out by default', () => {
    const deck = extractDeck(archidekt, archidektBody);
    expect(deck.deckName).toBe('Atraxa cool phyrexians');
    expect(deck.text).toBe("1 Atraxa, Praetors' Voice (C16) 28\n1 Sol Ring (CMM) 410\n7 Forest");
    expect(deck.skipped).toEqual({ Maybeboard: 1, Sideboard: 2 });
  });

  it('takes selected optional boards', () => {
    const deck = extractDeck(archidekt, archidektBody, ['sideboard']);
    expect(deck.text).toContain('2 Duress (M19)');
    expect(deck.text).not.toContain('Arcane Signet');
    expect(deck.skipped).toEqual({ Maybeboard: 1 });
  });

  it('reads edhrec tuples grouped by type', () => {
    const body = JSON.stringify({
      header: 'Average Deck for Atraxa',
      deck: { commander_v2: [["Atraxa, Praetors' Voice", 1]], cards: { Artifact: [['Sol Ring', 1]], Land: [['Forest', 3]] } },
    });
    const deck = extractDeck(edhrec, body);
    expect(deck.deckName).toBe('Average Deck for Atraxa');
    expect(deck.text).toBe("1 Atraxa, Praetors' Voice\n1 Sol Ring\n3 Forest");
  });

  it('assigns boards from labelled list paths', () => {
    const moxLike: DeckFinderConfig = {
      id: 9, name: 'm', category: 'MTG', dataFormat: 'json', quantityField: 'quantity', nameField: 'card.name', setField: 'card.set',
      numberField: 'card.cn', optionalBoards: 'Sideboard',
      entryListFields: 'boards.mainboard.cards.*, Sideboard=boards.sideboard.cards.*',
    };
    const body = JSON.stringify({ boards: {
      mainboard: { cards: { a: { quantity: 4, card: { name: 'Lightning Bolt', set: 'm10', cn: '146' } } } },
      sideboard: { cards: { b: { quantity: 2, card: { name: 'Duress', set: 'm19', cn: '94' } } } },
    } });
    expect(extractDeck(moxLike, body).text).toBe('4 Lightning Bolt (M10) 146');
    expect(extractDeck(moxLike, body, ['Sideboard']).text).toBe('4 Lightning Bolt (M10) 146\n2 Duress (M19) 94');
  });

  it('reads text lists with sections', () => {
    const body = '1 Ajani, Mentor of Heroes\n4x Forest\n\nSideboard:\n1 Duress\n\nCommander\n1 Atraxa, Praetors\' Voice';
    const deck = extractDeck(tappedout, body);
    expect(deck.text).toBe("1 Ajani, Mentor of Heroes\n4 Forest\n1 Atraxa, Praetors' Voice");
    expect(deck.skipped).toEqual({ Sideboard: 1 });
  });

  it('explains broken configs', () => {
    expect(() => extractDeck(archidekt, '<html>')).toThrow('kein JSON');
    expect(() => extractDeck({ ...archidekt, nameField: 'nope' }, archidektBody)).toThrow('Keine Karten');
  });
});

describe('extractSearchHits', () => {
  it('reads archidekt search results', () => {
    const body = JSON.stringify({ count: 1, results: [
      { id: 27125454, name: 'Atraxa cool phyrexians', size: 66, featured: 'https://img/x.webp', owner: { username: 'MotherPutin' } },
      { name: 'no id' },
    ] });
    expect(extractSearchHits(archidekt, body)).toEqual([
      { id: '27125454', name: 'Atraxa cool phyrexians', owner: 'MotherPutin', image: 'https://img/x.webp', info: '66' },
    ]);
  });
});
