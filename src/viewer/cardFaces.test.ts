import { splitCardFaces } from './cardFaces';
import { CardResult } from '../api/types/types';

const crop = { isStretch: false };
const card = (imageUrl: string, faceName?: string, apiName = 'scryfall'): CardResult => ({
  name: 'Delver of Secrets // Insectile Aberration', apiName, imageUrl, faceName, cropSettings: crop
});

describe('splitCardFaces', () => {
  it('legt die Rückseite als eigenen Eintrag mit gleicher Anzahl an', () => {
    const result = splitCardFaces({
      'Delver of Secrets': {
        count: 2,
        results: [
          card('front1', 'Delver of Secrets'), card('back1', 'Insectile Aberration'),
          card('front2', 'Delver of Secrets'), card('back2', 'Insectile Aberration'),
          card('other', undefined, 'mtgio')
        ]
      }
    });
    expect(result['Delver of Secrets'].results.map(r => r.imageUrl)).toEqual(['front1', 'front2', 'other']);
    expect(result['Insectile Aberration']).toEqual({ count: 2, results: [card('back1', 'Insectile Aberration'), card('back2', 'Insectile Aberration')] });
  });

  it('sucht man die Rückseite, wird die Vorderseite abgetrennt', () => {
    const result = splitCardFaces({
      'Insectile Aberration': { count: 1, results: [card('front1', 'Delver of Secrets'), card('back1', 'Insectile Aberration')] }
    });
    expect(Object.keys(result)).toEqual(['Insectile Aberration', 'Delver of Secrets']);
    expect(result['Insectile Aberration'].results.map(r => r.imageUrl)).toEqual(['back1']);
  });

  it('legt keinen zweiten Eintrag an, wenn die andere Seite schon in der Liste steht', () => {
    const result = splitCardFaces(
      { 'Delver of Secrets': { count: 1, results: [card('front1', 'Delver of Secrets'), card('back1', 'Insectile Aberration')] } },
      ['Insectile Aberration']
    );
    expect(Object.keys(result)).toEqual(['Delver of Secrets']);
    expect(result['Delver of Secrets'].results.map(r => r.imageUrl)).toEqual(['front1']);
  });

  it('lässt Karten ohne passende Seite unverändert', () => {
    const input = { 'Fire // Ice': { count: 1, results: [card('a', 'Fire'), card('b', 'Ice')] } };
    expect(splitCardFaces(input)).toEqual(input);
  });
});
