import React from 'react';
import { render, screen } from '@testing-library/react';
import SearchLog from './SearchLog';
import { LogEntry } from '../../api/types/types';

const running = (extra: Partial<LogEntry>): LogEntry =>
  ({ id: 1, configName: 'Scryfall', cardName: 'Sol Ring', source: 'running', count: 0, durationMs: 0, requestCount: 0, ...extra });

const cells = () => screen.getAllByRole('cell').map(cell => cell.textContent);

describe('SearchLog', () => {
  it('zeigt eine laufende Suche ohne fertige Seite mit Fortschrittssymbol und ohne Werte', () => {
    render(<SearchLog entries={[running({})]} onShowRaw={() => {}} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByLabelText('Searching')).toBeInTheDocument();
    expect(cells()).toEqual(['Scryfall', '', '–', '–', '–', 'Sol Ring']);
  });

  it('zeigt den Stand der letzten fertigen Seite', () => {
    render(<SearchLog entries={[running({ count: 12, durationMs: 1500, requestCount: 2 })]} onShowRaw={() => {}} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(cells()).toEqual(['Scryfall', '', '12', '1.5s', '2', 'Sol Ring']);
  });
});

describe('SearchLog Reihenfolge', () => {
  it('zeigt neue Einträge oben', () => {
    const done = (id: number, cardName: string): LogEntry =>
      ({ id, configName: 'Scryfall', cardName, source: 'network', count: 1, durationMs: 10, requestCount: 1 });
    render(<SearchLog entries={[done(1, 'Sol Ring'), done(2, 'Island')]} onShowRaw={() => {}} />);
    const names = screen.getAllByRole('row').slice(1).map(row => row.lastChild?.textContent);
    expect(names).toEqual(['Island', 'Sol Ring']);
  });
});
