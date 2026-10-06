import { CardResult, CardResultsMap } from '../../api/types/types';
import { defaultSettings } from '../../viewer/pdf/SettingsDialog';
import {
  WorkState, createSnapshot, customUploadIds, isEmptyState, migrateSnapshot, overwriteSnapshot, restoreSnapshot, snapshotLabel, SNAPSHOT_VERSION,
} from './snapshot';

const card = (name: string, apiName: string, imageUrl: string, languageCode = 'en'): CardResult => ({
  name, apiName, imageUrl, languageCode, cropSettings: { offSetX: 0, offSetY: 0, width: 0, height: 0, isStretch: true },
});

function workState(): WorkState {
  const bolt = [card('Lightning Bolt', 'scryfall', 'https://img/bolt1'), card('Lightning Bolt', 'scryfall', 'https://img/bolt2')];
  const token = card('Token', 'custom', '/api/files/download/abc.png');
  const cardResults: CardResultsMap = {
    'Lightning Bolt': { count: 2, results: bolt },
    'Token_crop0': { count: 1, results: [token] },
  };
  // Zweiter Slot: Kopie mit eigenem Crop
  const croppedCopy = { ...bolt[0], cropSettings: { offSetX: 5, offSetY: 6, width: 100, height: 140, isStretch: false } };
  return {
    decklist: '2 Lightning Bolt (M10) 146',
    cardResults,
    selectedCards: { 'Lightning Bolt': [bolt[1], croppedCopy], 'Token_crop0': [token] },
    enabledApis: { scryfall: true, mtgbuilder: false },
    visibleLanguages: new Set(['en']),
    visibleApis: new Set(['scryfall']),
    uniquePrints: true,
    settings: { ...defaultSettings, width: 70, email: 'me@example.com' },
  };
}

describe('snapshot', () => {
  it('overwrites a snapshot with the current state, keeping id and custom name', () => {
    const old = createSnapshot({ ...workState(), decklist: '1 Island', cardResults: {}, selectedCards: {} }, 'generate', 1000);
    old.label.custom = 'My Deck';
    old.pdf.generated = { progressId: 'p1', createdAt: 1000 };
    const updated = overwriteSnapshot(old, workState(), 2000);
    expect(updated.id).toBe(old.id);
    expect(snapshotLabel(updated)).toBe('My Deck');
    expect(updated.label.cardCount).toBe(3);
    expect(updated.kind).toBe('manual');
    expect(updated.createdAt).toBe(2000);
    expect(updated.pdf.generated).toBeUndefined();
    expect(updated.contentHash).toBe(createSnapshot(workState(), 'manual').contentHash);
  });

  it('keeps the automatic name of a snapshot without custom name', () => {
    const old = createSnapshot({ ...workState(), decklist: '1 Island', cardResults: {}, selectedCards: {} }, 'manual', 1000);
    expect(snapshotLabel(overwriteSnapshot(old, workState(), 2000))).toBe('1 card · Island');
  });


  it('round-trips results, selection, crops, filters and pdf settings', () => {
    const snapshot = createSnapshot(workState(), 'manual', 1000);
    const { state, droppedCustomCards } = restoreSnapshot(migrateSnapshot(JSON.parse(JSON.stringify(snapshot))));

    expect(droppedCustomCards).toBe(0);
    expect(state.decklist).toBe('2 Lightning Bolt (M10) 146');
    expect(state.enabledApis).toEqual(['scryfall']);
    expect(Array.from(state.visibleLanguages)).toEqual(['en']);
    expect(Array.from(state.visibleApis)).toEqual(['scryfall']);
    expect(state.settings.width).toBe(70);
    expect((state.settings as any).email).toBeUndefined();

    const bolts = state.cardResults['Lightning Bolt'];
    expect(bolts.count).toBe(2);
    const [first, second] = state.selectedCards['Lightning Bolt'];
    // Unveränderte Auswahl zeigt auf das Ergebnis selbst
    expect(first).toBe(bolts.results[1]);
    // Kopie mit eigenem Crop bleibt eine Kopie
    expect(second).not.toBe(bolts.results[0]);
    expect(second?.imageUrl).toBe('https://img/bolt1');
    expect(second?.cropSettings).toEqual({ offSetX: 5, offSetY: 6, width: 100, height: 140, isStretch: false });
  });

  it('keeps which selections were picked by hand', () => {
    const state = workState();
    state.manualPicks = { 'Lightning Bolt': [null, state.selectedCards['Lightning Bolt'][1]] };
    const snapshot = createSnapshot(state, 'manual');
    expect(snapshot.search.entries[0].manual).toEqual([1]);
    const restored = restoreSnapshot(migrateSnapshot(JSON.parse(JSON.stringify(snapshot)))).state;
    const [first, second] = restored.manualPicks['Lightning Bolt'];
    expect(first).toBeNull();
    expect(second).toBe(restored.selectedCards['Lightning Bolt'][1]);
    expect(restored.manualPicks['Token_crop0']).toBeUndefined();
  });

  it('treats every selection of an older snapshot as picked by hand', () => {
    const snapshot = createSnapshot(workState(), 'manual');
    snapshot.search.entries.forEach(entry => { delete entry.manual; });
    const restored = restoreSnapshot(snapshot).state;
    expect(restored.manualPicks['Lightning Bolt']).toEqual(restored.selectedCards['Lightning Bolt']);
  });

  it('labels with card count and first card', () => {
    const snapshot = createSnapshot(workState(), 'manual');
    expect(snapshot.label).toEqual({ cardCount: 3, firstCard: 'Lightning Bolt' });
    expect(snapshotLabel(snapshot)).toBe('3 cards · Lightning Bolt');
    expect(snapshotLabel({ ...snapshot, label: { ...snapshot.label, custom: 'Burn' } })).toBe('Burn');
  });

  it('takes the first decklist line before the first search', () => {
    const snapshot = createSnapshot({ ...workState(), cardResults: {}, selectedCards: {}, decklist: '4x Goblin Guide (ZEN) 126\n2 Bolt' }, 'session');
    expect(snapshot.label).toEqual({ cardCount: 6, firstCard: 'Goblin Guide' });
  });

  it('gives the same hash for the same content', () => {
    const a = createSnapshot(workState(), 'manual', 1);
    const b = createSnapshot(workState(), 'generate', 2);
    expect(a.contentHash).toBe(b.contentHash);
    const changed = workState();
    changed.cardResults['Lightning Bolt'].results[0].cropSettings.offSetX = 9;
    expect(createSnapshot(changed, 'manual').contentHash).not.toBe(a.contentHash);
  });

  it('drops custom cards whose upload is gone', () => {
    const snapshot = createSnapshot(workState(), 'manual');
    expect(customUploadIds(snapshot)).toEqual(['abc.png']);
    const { state, droppedCustomCards } = restoreSnapshot(snapshot, ['abc.png']);
    expect(droppedCustomCards).toBe(1);
    expect(state.cardResults['Token_crop0']).toBeUndefined();
    expect(state.cardResults['Lightning Bolt']).toBeDefined();
  });

  it('falls back to the url when the result order changed', () => {
    const snapshot = createSnapshot(workState(), 'manual');
    const entry = snapshot.search.entries[0];
    entry.results.reverse();
    const { state } = restoreSnapshot(snapshot);
    expect(state.selectedCards['Lightning Bolt'][0]?.imageUrl).toBe('https://img/bolt2');
  });

  it('rejects foreign or newer formats and fills missing fields', () => {
    expect(() => migrateSnapshot({ format: 'other', version: 1 })).toThrow();
    expect(() => migrateSnapshot({ format: 'proxyprinter-snapshot', version: SNAPSHOT_VERSION + 1 })).toThrow();
    const minimal = migrateSnapshot({ format: 'proxyprinter-snapshot', version: 1, id: 'x', kind: 'manual', createdAt: 1, label: { cardCount: 0, firstCard: '' }, contentHash: '' });
    expect(minimal.search.uniquePrints).toBe(true);
    expect(minimal.search.entries).toEqual([]);
    expect(minimal.pdf.settings.width).toBe(defaultSettings.width);
  });

  it('treats a blank page as empty', () => {
    expect(isEmptyState({ decklist: '  ', cardResults: {} })).toBe(true);
    expect(isEmptyState({ decklist: '1 Forest', cardResults: {} })).toBe(false);
  });
});
