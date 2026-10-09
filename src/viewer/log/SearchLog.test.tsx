import React from 'react';
import { render, screen } from '@testing-library/react';
import SearchLog from './SearchLog';
import { LogEntry } from '../../api/types/types';

const done = (cardName: string, extra: Partial<LogEntry> = {}): LogEntry =>
  ({ configName: 'Scryfall', cardName, source: 'network', count: 12, durationMs: 1500, requestCount: 2, ...extra });

const rowCells = () => screen.getAllByRole('row').slice(1).map(row => Array.from(row.children).map(cell => cell.textContent));

describe('SearchLog', () => {
  it('zeigt Requests vor Dauer und Treffern', () => {
    render(<SearchLog entries={[done('Sol Ring')]} onShowRaw={() => {}} />);
    expect(rowCells()).toEqual([['Scryfall', '', '2', '1.5s', '12', 'Sol Ring']]);
  });

  it('hängt neue Einträge unten an', () => {
    render(<SearchLog entries={[done('Sol Ring'), done('Island')]} onShowRaw={() => {}} />);
    expect(rowCells().map(cells => cells[5])).toEqual(['Sol Ring', 'Island']);
  });

  it('zeigt bei Fehlern keine Treffer', () => {
    render(<SearchLog entries={[done('Sol Ring', { source: 'error', requestCount: undefined, error: 'boom' })]} onShowRaw={() => {}} />);
    expect(rowCells()).toEqual([['Scryfall', '', '–', '1.5s', '–', 'Sol Ring']]);
  });
});
