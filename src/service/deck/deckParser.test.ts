import { formatDeckLine, parseDeckLine, parseDecklist, sectionHeader } from './deckParser';

describe('parseDeckLine', () => {
  it('reads plain and x counts', () => {
    expect(parseDeckLine('4 Lightning Bolt')).toEqual({ count: 4, name: 'Lightning Bolt' });
    expect(parseDeckLine('1x Sol Ring')).toEqual({ count: 1, name: 'Sol Ring' });
    expect(parseDeckLine('2 x Counterspell')).toEqual({ count: 2, name: 'Counterspell' });
  });

  it('treats lines without count as one copy', () => {
    expect(parseDeckLine('Sol Ring')).toEqual({ count: 1, name: 'Sol Ring' });
  });

  it('reads arena form with set and number', () => {
    expect(parseDeckLine('4 Lightning Bolt (M10) 146')).toEqual({ count: 4, name: 'Lightning Bolt', set: 'M10', number: '146' });
    expect(parseDeckLine('1 Sol Ring (cmm)')).toEqual({ count: 1, name: 'Sol Ring', set: 'CMM' });
    expect(parseDeckLine('1 Sol Ring (CMM 410)')).toEqual({ count: 1, name: 'Sol Ring', set: 'CMM', number: '410' });
  });

  it('strips foil markers and tags', () => {
    expect(parseDeckLine('1 Sol Ring (CMM) 410 *F*')).toEqual({ count: 1, name: 'Sol Ring', set: 'CMM', number: '410' });
    expect(parseDeckLine('1x Sol Ring (cmm) 410 [Ramp]')).toEqual({ count: 1, name: 'Sol Ring', set: 'CMM', number: '410' });
    expect(parseDeckLine('1 Arcane Signet [Ramp] ^Have^')).toEqual({ count: 1, name: 'Arcane Signet' });
  });

  it('keeps names with brackets that are no set', () => {
    expect(parseDeckLine('1 Circle of Protection: Red')).toEqual({ count: 1, name: 'Circle of Protection: Red' });
    expect(parseDeckLine('1 Fire // Ice')).toEqual({ count: 1, name: 'Fire // Ice' });
  });

  it('skips headers, comments and links', () => {
    ['Sideboard', 'Sideboard:', 'Commander', 'Lands (36)', '// Lands', 'Pokémon: 13', 'Total Cards: 60',
      '', '   ', '# comment', 'https://archidekt.com/decks/1'].forEach(line => {
      expect(parseDeckLine(line)).toBeNull();
    });
  });
});

describe('sectionHeader', () => {
  it('names the section', () => {
    expect(sectionHeader('Sideboard:')).toBe('Sideboard');
    expect(sectionHeader('Maybeboard (12)')).toBe('Maybeboard');
    expect(sectionHeader('1 Sideboard Strategist')).toBeNull();
    expect(sectionHeader('Sol Ring')).toBeNull();
  });
});

describe('parseDecklist / formatDeckLine', () => {
  it('round trips', () => {
    const entries = parseDecklist('Deck\n4 Lightning Bolt (m10) 146\n\nSideboard\n2 Duress');
    expect(entries).toEqual([
      { count: 4, name: 'Lightning Bolt', set: 'M10', number: '146' },
      { count: 2, name: 'Duress' },
    ]);
    expect(entries.map(formatDeckLine)).toEqual(['4 Lightning Bolt (M10) 146', '2 Duress']);
    expect(formatDeckLine({ count: 1, name: 'Sol Ring', set: 'cmm' })).toBe('1 Sol Ring (CMM)');
  });
});
