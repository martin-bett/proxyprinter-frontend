import React from 'react';
import { render, screen } from '@testing-library/react';
import RunningSearches from './RunningSearches';
import { RunningSearch } from './useSearchActivity';

const search = (extra: Partial<RunningSearch>): RunningSearch =>
  ({ id: 1, configName: 'Scryfall', cardName: 'Sol Ring', startedAt: performance.now(), count: 0, requestCount: 0, ...extra });

const rowCells = () => screen.getAllByRole('row').slice(1).map(row => Array.from(row.children).map(cell => cell.textContent));

describe('RunningSearches', () => {
  it('ist ohne offene Suchen nicht da', () => {
    const { container } = render(<RunningSearches running={[]} pendingByApi={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('zeigt je API eine Zeile, auch ohne Ergebnis und für wartende APIs', () => {
    render(<RunningSearches running={[search({})]} pendingByApi={{ Scryfall: 3, MPCFill: 2 }} />);
    expect(screen.getByText('Running')).toBeInTheDocument();
    const rows = rowCells();
    expect(rows[0][0]).toBe('Scryfall');
    expect(rows[0][1]).toBe('0');
    expect(rows[0][2]).toMatch(/ms|s$/);
    expect(rows[0][3]).toBe('Sol Ring');
    expect(rows[0][4]).toBe('0');
    expect(rows[1]).toEqual(['MPCFill', '–', '–', '–', '–']);
  });

  it('zeigt gleichzeitige Suchen einer API als eigene Zeilen mit dem API-Namen nur einmal', () => {
    render(<RunningSearches
      running={[search({ count: 4, requestCount: 1 }), search({ id: 2, cardName: 'Island', count: 6, requestCount: 2 })]}
      pendingByApi={{ Scryfall: 2 }}
    />);
    const [first, second] = rowCells();
    expect(first[0]).toBe('Scryfall');
    expect([first[1], first[3], first[4]]).toEqual(['1', 'Sol Ring', '4']);
    expect(second).toHaveLength(4);
    expect([second[0], second[2], second[3]]).toEqual(['2', 'Island', '6']);
    expect(screen.getByText('Scryfall')).toHaveAttribute('rowspan', '2');
  });
});
