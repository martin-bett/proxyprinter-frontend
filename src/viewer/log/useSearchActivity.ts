import { useCallback, useRef, useState } from 'react';
import { LogEntry } from '../../api/types/types';
import { PageProgress } from '../../service/ApiFactory';

/** Netzsuche, die gerade läuft: Stand der letzten fertigen Seite */
export interface RunningSearch {
  id: number;
  configName: string;
  cardName: string;
  startedAt: number;
  count: number;
  requestCount: number;
}

/** Laufende Netzsuche: Fortschritt je Seite, am Ende wandert sie als fertiger Eintrag ins Log */
export interface NetworkLog {
  onPage: (progress: PageProgress) => void;
  finish: (entry: LogEntry) => void;
}

export interface SearchActivity {
  log: LogEntry[];
  running: RunningSearch[];
  /** Offene Suchen je API-Config (wartend oder laufend); ohne Eintrag ist die API fertig */
  pendingByApi: Record<string, number>;
  addToLog: (entry: LogEntry) => void;
  startNetworkLog: (configName: string, cardName: string, startedAt: number) => NetworkLog;
  finishLog: (entry: LogEntry, run: NetworkLog | undefined) => void;
  /** Meldet count Suchen für eine API an; die Rückgabe meldet je Aufruf eine davon als fertig */
  beginApi: (configName: string, count: number) => () => void;
  clear: () => void;
}

// Search Log und laufende Suchen. Nach clear() kommen später fertige Suchen nicht mehr zurück.
export function useSearchActivity(): SearchActivity {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState<RunningSearch[]>([]);
  const [pendingByApi, setPendingByApi] = useState<Record<string, number>>({});
  const generation = useRef(0);
  const nextId = useRef(0);

  const addToLog = useCallback((entry: LogEntry) => setLog(prev => [...prev, entry]), []);

  const changePending = (configName: string, delta: number) => setPendingByApi(prev => {
    const next = { ...prev };
    const count = (prev[configName] ?? 0) + delta;
    if (count > 0) next[configName] = count;
    else delete next[configName];
    return next;
  });

  const beginApi = useCallback((configName: string, count: number) => {
    const started = generation.current;
    changePending(configName, count);
    return () => {
      if (generation.current === started) changePending(configName, -1);
    };
  }, []);

  const startNetworkLog = useCallback((configName: string, cardName: string, startedAt: number): NetworkLog => {
    const id = ++nextId.current;
    const started = generation.current;
    setRunning(prev => [...prev, { id, configName, cardName, startedAt, count: 0, requestCount: 0 }]);
    const remove = () => setRunning(prev => prev.filter(search => search.id !== id));
    return {
      onPage: ({ count, requestCount }) => setRunning(prev => prev.map(search => (search.id === id ? { ...search, count, requestCount } : search))),
      finish: (entry) => {
        remove();
        if (generation.current === started) addToLog(entry);
      },
    };
  }, [addToLog]);

  const finishLog = useCallback((entry: LogEntry, run: NetworkLog | undefined) => (run ? run.finish(entry) : addToLog(entry)), [addToLog]);

  const clear = useCallback(() => {
    generation.current++;
    setLog([]);
    setRunning([]);
    setPendingByApi({});
  }, []);

  return { log, running, pendingByApi, addToLog, startNetworkLog, finishLog, beginApi, clear };
}
