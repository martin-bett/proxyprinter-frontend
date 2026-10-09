import { act, renderHook } from '@testing-library/react';
import { NetworkLog, useSearchActivity } from './useSearchActivity';
import { LogEntry } from '../../api/types/types';

const entry = (cardName: string): LogEntry =>
  ({ configName: 'Scryfall', cardName, source: 'network', count: 1, durationMs: 10, requestCount: 1 });

describe('useSearchActivity', () => {
  it('führt Netzsuchen als laufend und schreibt sie fertig ins Log', () => {
    const { result } = renderHook(() => useSearchActivity());
    let done: () => void = () => {};
    act(() => { done = result.current.beginApi('Scryfall', 1); });
    expect(result.current.pendingByApi).toEqual({ Scryfall: 1 });
    let run: NetworkLog | undefined;
    act(() => { run = result.current.startNetworkLog('Scryfall', 'Sol Ring', 0); });
    act(() => run!.onPage({ count: 5, requestCount: 1 }));
    expect(result.current.running.map(search => search.count)).toEqual([5]);
    expect(result.current.log).toEqual([]);
    act(() => { run!.finish(entry('Sol Ring')); done(); });
    expect(result.current.running).toEqual([]);
    expect(result.current.pendingByApi).toEqual({});
    expect(result.current.log).toEqual([entry('Sol Ring')]);
  });

  it('lässt nach clear() keine alten Suchen zurück ins Log', () => {
    const { result } = renderHook(() => useSearchActivity());
    let done: () => void = () => {};
    let run: NetworkLog | undefined;
    act(() => { done = result.current.beginApi('Scryfall', 1); run = result.current.startNetworkLog('Scryfall', 'Sol Ring', 0); });
    act(() => result.current.clear());
    act(() => result.current.beginApi('Scryfall', 2));
    act(() => { run!.finish(entry('Sol Ring')); done(); });
    expect(result.current.log).toEqual([]);
    expect(result.current.pendingByApi).toEqual({ Scryfall: 2 });
  });
});
