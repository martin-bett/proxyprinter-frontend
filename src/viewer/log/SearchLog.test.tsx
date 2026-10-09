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
