import 'fake-indexeddb/auto';
import { act, renderHook, waitFor } from '@testing-library/react';
import { CardResult } from '../../api/types/types';
import { defaultSettings } from '../pdf/SettingsDialog';
import { RestoredState, WorkState } from '../../service/snapshot/snapshot';
import { deleteAllSnapshots, listSnapshots } from '../../service/snapshot/SnapshotStore';
import { useSnapshots } from './useSnapshots';

// jsdom (Jest 27) kennt structuredClone nicht; Snapshots sind reine JSON-Daten.
if (typeof (global as any).structuredClone !== 'function') {
  (global as any).structuredClone = (value: unknown) => JSON.parse(JSON.stringify(value));
}

jest.mock('../../service/snapshot/snapshotBackend', () => ({
  fetchPdfInfo: jest.fn().mockResolvedValue(null),
  touchUploads: jest.fn().mockResolvedValue([]),
  pdfDownloadUrl: jest.fn(),
  pdfFileName: jest.fn(),
}));

const card = (name: string, imageUrl: string): CardResult => ({
  name, apiName: 'scryfall', imageUrl, languageCode: 'en', cropSettings: { offSetX: 0, offSetY: 0, width: 0, height: 0, isStretch: true },
});

function deck(name: string): WorkState {
  const results = [card(name, `https://img/${name}1`), card(name, `https://img/${name}2`)];
  return {
    decklist: `1 ${name}`,
    cardResults: { [name]: { count: 1, results } },
    selectedCards: { [name]: [results[0]] },
    enabledApis: { scryfall: true },
    visibleLanguages: new Set(['en']),
    visibleApis: new Set(['scryfall']),
    uniquePrints: false,
    settings: { ...defaultSettings },
  };
}

// Viewer im Kleinen: apply übernimmt den geladenen Stand
function setup(initial: WorkState) {
  let current = initial;
  const hook = renderHook(({ state }) => useSnapshots({
    state,
    isBusy: false,
    apply: (restored: RestoredState) => {
      current = {
        ...restored,
        enabledApis: Object.fromEntries(restored.enabledApis.map(name => [name, true])),
        settings: { ...restored.settings, sendMail: current.settings.sendMail },
      };
      hook.rerender({ state: current });
    },
  }), { initialProps: { state: initial } });
  const setState = (state: WorkState) => { current = state; hook.rerender({ state }); };
  return { hook, setState, get state() { return current; } };
}

const leavePage = () => act(async () => { window.dispatchEvent(new Event('pagehide')); await new Promise(r => setTimeout(r, 20)); });

beforeEach(async () => {
  await deleteAllSnapshots();
  localStorage.clear();
});

test('a loaded snapshot is overwritten on leaving instead of a new session', async () => {
  const view = setup(deck('Bolt'));
  await act(() => view.hook.result.current.sectionProps.onSave());
  const saved = (await listSnapshots())[0];
  expect(view.hook.result.current.sectionProps.activeId).toBe(saved.id);

  view.setState(deck('Shock'));
  await leavePage();

  const all = await listSnapshots();
  expect(all).toHaveLength(1);
  expect(all[0].id).toBe(saved.id);
  expect(all[0].search.decklist).toBe('1 Shock');
});

test('loading a snapshot makes it active and leaving without changes keeps it as is', async () => {
  const view = setup(deck('Bolt'));
  await act(() => view.hook.result.current.sectionProps.onSave());
  view.setState(deck('Shock'));
  await act(() => view.hook.result.current.release());
  await leavePage();
  const before = await listSnapshots();
  const manual = before.find(s => s.kind === 'manual')!;
  expect(before.find(s => s.kind === 'session')?.search.decklist).toBe('1 Shock');

  await act(() => view.hook.result.current.sectionProps.onLoad(manual));
  await waitFor(() => expect(view.hook.result.current.sectionProps.activeId).toBe(manual.id));
  await leavePage();
  const after = (await listSnapshots()).find(s => s.id === manual.id)!;
  expect(after.createdAt).toBe(manual.createdAt);
});

test('release stops overwriting, the next leave writes the session again', async () => {
  const view = setup(deck('Bolt'));
  await act(() => view.hook.result.current.sectionProps.onSave());
  await act(() => view.hook.result.current.release());
  expect(view.hook.result.current.sectionProps.activeId).toBeNull();

  view.setState(deck('Shock'));
  await leavePage();
  const all = await listSnapshots();
  expect(all.find(s => s.kind === 'manual')?.search.decklist).toBe('1 Bolt');
  expect(all.find(s => s.kind === 'session')?.search.decklist).toBe('1 Shock');
});

test('saveAndRelease writes into the active snapshot, without one it saves a new one', async () => {
  const view = setup(deck('Bolt'));
  await act(() => view.hook.result.current.sectionProps.onSave());
  view.setState(deck('Shock'));
  await act(() => view.hook.result.current.saveAndRelease());
  let all = await listSnapshots();
  expect(all).toHaveLength(1);
  expect(all[0].search.decklist).toBe('1 Shock');
  expect(view.hook.result.current.sectionProps.activeId).toBeNull();

  view.setState(deck('Opt'));
  await act(() => view.hook.result.current.saveAndRelease());
  all = await listSnapshots();
  expect(all).toHaveLength(2);
  expect(view.hook.result.current.sectionProps.activeId).toBeNull();
});

test('after a reload the last active snapshot is offered as last session', async () => {
  const first = setup(deck('Bolt'));
  await act(() => first.hook.result.current.sectionProps.onSave());
  const id = first.hook.result.current.sectionProps.activeId;
  first.hook.unmount();

  const empty: WorkState = { ...deck('Bolt'), decklist: '', cardResults: {}, selectedCards: {} };
  const second = setup(empty);
  await waitFor(() => expect(second.hook.result.current.sectionProps.session?.id).toBe(id));
});
