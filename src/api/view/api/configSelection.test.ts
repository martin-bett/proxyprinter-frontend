import { refreshStoredSelection, refreshStoredSelectionChecked } from './configSelection';
import { Config } from '../../../service/ApiFactory';

describe('refreshStoredSelection', () => {
  beforeEach(() => localStorage.clear());

  it('ersetzt gespeicherte Configs durch die aktuelle Fassung', () => {
    localStorage.setItem('setConfigs', JSON.stringify([{ id: 3, name: 'mtggatherer' }, { id: 9, name: 'weg' }]));
    const fresh = [{ id: 3, name: 'mtggatherer', proxyImages: true }, { id: 4, name: 'andere' }] as unknown as Config[];
    const updated = refreshStoredSelection(fresh)!;
    expect(updated).toEqual([{ id: 3, name: 'mtggatherer', proxyImages: true }, { id: 9, name: 'weg' }]);
    expect(JSON.parse(localStorage.getItem('setConfigs')!)).toEqual(updated);
  });

  it('entfernt gesperrte Configs aus Auswahl und IDs', () => {
    localStorage.setItem('setConfigs', JSON.stringify([{ id: 3, name: 'a' }, { id: 9, name: 'gesperrt' }]));
    localStorage.setItem('selectedConfigs', JSON.stringify([3, 9]));
    const updated = refreshStoredSelection([{ id: 3, name: 'a' }] as unknown as Config[], [9])!;
    expect(updated).toEqual([{ id: 3, name: 'a' }]);
    expect(JSON.parse(localStorage.getItem('selectedConfigs')!)).toEqual([3]);
  });

  it('fragt nur nach nicht mehr ausgelieferten Configs', async () => {
    localStorage.setItem('setConfigs', JSON.stringify([{ id: 3, name: 'a' }, { id: 9, name: 'gesperrt' }, { id: 12, name: 'eigene' }]));
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => [9] });
    (global as any).fetch = fetchMock;
    const updated = await refreshStoredSelectionChecked([{ id: 3, name: 'a' }] as unknown as Config[]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual([9, 12]);
    expect(updated).toEqual([{ id: 3, name: 'a' }, { id: 12, name: 'eigene' }]);
  });

  it('macht nichts ohne gespeicherte Auswahl', () => {
    expect(refreshStoredSelection([])).toBeNull();
  });
});
