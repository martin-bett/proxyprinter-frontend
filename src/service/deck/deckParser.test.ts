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

  it('reads the Pokémon TCG Live form without brackets', () => {
    expect(parseDeckLine('4 Pikachu ex SVI 57')).toEqual({ count: 4, name: 'Pikachu ex', set: 'SVI', number: '57' });
    expect(parseDeckLine('2 Charizard VMAX DAA 20')).toEqual({ count: 2, name: 'Charizard VMAX', set: 'DAA', number: '20' });
    expect(parseDeckLine('1 Mew PR-SW SWSH160')).toEqual({ count: 1, name: 'Mew', set: 'PR-SW', number: 'SWSH160' });
    expect(parseDeckLine('* 4 Pikachu BRS 49')).toEqual({ count: 4, name: 'Pikachu', set: 'BRS', number: '49' });
    expect(parseDeckLine('4 Pikachu ex')).toEqual({ count: 4, name: 'Pikachu ex' });
    expect(parseDeckLine('1 Borrowing 100,000 Arrows')).toEqual({ count: 1, name: 'Borrowing 100,000 Arrows' });
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
