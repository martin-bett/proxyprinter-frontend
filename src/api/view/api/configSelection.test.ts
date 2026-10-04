import { refreshStoredSelection } from './configSelection';
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

  it('macht nichts ohne gespeicherte Auswahl', () => {
    expect(refreshStoredSelection([])).toBeNull();
  });
});
