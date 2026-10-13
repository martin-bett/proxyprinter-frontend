import { downloadFileName } from './imageDownload';

const card = { name: 'Lightning Bolt', apiName: 'Scryfall', imageUrl: 'https://example.org/img/bolt.png?x=1' };

describe('downloadFileName', () => {
  it('nimmt Set, Nummer, Quelle und Sprache in den Namen', () => {
    expect(downloadFileName({ ...card, set: 'M10', setNumber: '146', languageCode: 'de' }, 'image/jpeg'))
      .toBe('Lightning Bolt (M10 146, Scryfall, de).jpg');
  });

  it('nimmt die Endung aus der URL, wenn der Mime-Typ fehlt', () => {
    expect(downloadFileName(card)).toBe('Lightning Bolt (Scryfall).png');
    expect(downloadFileName({ ...card, imageUrl: 'https://example.org/show?id=5' })).toBe('Lightning Bolt (Scryfall).jpg');
  });

  it('ersetzt Zeichen, die in Dateinamen nicht erlaubt sind', () => {
    expect(downloadFileName({ ...card, name: 'Fire // Ice', apiName: 'A:B' }, 'image/webp'))
      .toBe('Fire __ Ice (A_B).webp');
  });
});
