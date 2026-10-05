import { IDBFactory } from 'fake-indexeddb';
import { Snapshot } from './snapshot';

// jsdom (Jest 27) kennt structuredClone nicht; Snapshots sind reine JSON-Daten.
if (typeof (global as any).structuredClone !== 'function') {
  (global as any).structuredClone = (value: unknown) => JSON.parse(JSON.stringify(value));
}

type Store = typeof import('./SnapshotStore');

function loadStore(): Store {
  let store!: Store;
  jest.isolateModules(() => {
    store = require('./SnapshotStore');
  });
  return store;
}

const snapshot = (id: string, kind: Snapshot['kind'], createdAt: number, contentHash = id): Snapshot => ({
  format: 'proxyprinter-snapshot',
  version: 1,
  id,
  kind,
  createdAt,
  label: { cardCount: 1, firstCard: 'Forest' },
  contentHash,
  search: { decklist: '1 Forest', enabledApis: [], filters: { languages: [], apis: [] }, uniquePrints: true, entries: [] },
  pdf: { settings: {} as any, generated: kind === 'generate' ? { progressId: `pdf-${id}`, createdAt } : undefined },
});

describe('SnapshotStore', () => {
  beforeEach(() => {
    (global as any).indexedDB = new IDBFactory();
  });

  it('stores, lists newest first and deletes', async () => {
    const store = loadStore();
    await store.putSnapshot(snapshot('a', 'manual', 1));
    await store.putSnapshot(snapshot('b', 'manual', 2));
    expect((await store.listSnapshots()).map(s => s.id)).toEqual(['b', 'a']);
    await store.deleteSnapshot('b');
    expect((await store.listSnapshots()).map(s => s.id)).toEqual(['a']);
    await store.deleteAllSnapshots();
    expect(await store.listSnapshots()).toEqual([]);
  });

  it('keeps one session snapshot', async () => {
    const store = loadStore();
    await store.putSnapshot(snapshot('session', 'session', 1, 'old'));
    await store.putSnapshot(snapshot('session', 'session', 2, 'new'));
    const all = await store.listSnapshots();
    expect(all).toHaveLength(1);
    expect(all[0].contentHash).toBe('new');
  });

  it('keeps at most ten generate snapshots and merges identical content', async () => {
    const store = loadStore();
    for (let i = 0; i < 12; i++) {
      await store.putGenerateSnapshot(snapshot(`g${i}`, 'generate', i, `hash${i}`));
    }
    await store.putSnapshot(snapshot('m', 'manual', 0));
    let all = await store.listSnapshots();
    expect(all.filter(s => s.kind === 'generate')).toHaveLength(store.MAX_GENERATE_SNAPSHOTS);
    expect(all.some(s => s.id === 'g0' || s.id === 'g1')).toBe(false);
    expect(all.some(s => s.id === 'm')).toBe(true);

    // Gleicher Inhalt erneut generiert: kein neuer Eintrag, nur neues PDF und neue Zeit
    const saved = await store.putGenerateSnapshot(snapshot('again', 'generate', 100, 'hash5'));
    expect(saved.id).toBe('g5');
    expect(saved.pdf.generated?.progressId).toBe('pdf-again');
    all = await store.listSnapshots();
    expect(all[0].id).toBe('g5');
    expect(all.filter(s => s.kind === 'generate')).toHaveLength(store.MAX_GENERATE_SNAPSHOTS);
  });
});
