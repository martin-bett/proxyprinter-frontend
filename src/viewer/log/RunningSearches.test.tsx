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
    expect(screen.getByText('Running searches')).toBeInTheDocument();
    const rows = rowCells();
    expect(rows[0][0]).toBe('Scryfall');
    expect(rows[0][1]).toBe('0');
    expect(rows[0][2]).toMatch(/ms|s$/);
    expect(rows[0][3]).toBe('Sol Ring');
    expect(rows[0][4]).toBe('0');
    expect(rows[1]).toEqual(['MPCFill', '–', '–', '–', '–']);
  });

  it('fasst gleichzeitige Suchen einer API zusammen', () => {
    render(<RunningSearches
      running={[search({ count: 4, requestCount: 1 }), search({ id: 2, cardName: 'Island', count: 6, requestCount: 2 })]}
      pendingByApi={{ Scryfall: 2 }}
    />);
    const [row] = rowCells();
    expect(row[1]).toBe('3');
    expect(row[3]).toBe('Sol Ring +1');
    expect(row[4]).toBe('10');
  });
});
