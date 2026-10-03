import { parseRawResponse } from './RawDataDialog';

describe('parseRawResponse', () => {
  it('parst eine einzelne JSON-Antwort', () => {
    expect(parseRawResponse('{"a":1}')).toEqual({ kind: 'json', data: { a: 1 } });
  });

  it('fasst mehrseitige Antworten als Array zusammen', () => {
    expect(parseRawResponse('{"page":1}\n{"page":2}')).toEqual({
      kind: 'json',
      data: [{ page: 1 }, { page: 2 }],
    });
  });

  it('zeigt Nicht-JSON als Text an', () => {
    expect(parseRawResponse('<html></html>')).toEqual({ kind: 'text', text: '<html></html>' });
  });

  it('zeigt JSON-Primitive als Text an', () => {
    expect(parseRawResponse('42')).toEqual({ kind: 'text', text: '42' });
  });
});
