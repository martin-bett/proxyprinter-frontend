import { detectInstance } from './instance';

describe('detectInstance', () => {
  it('leaves production unchanged', () => {
    expect(detectInstance('proxyprinter.eu')).toEqual({ kind: 'prod', label: '', favicon: null });
    expect(detectInstance('www.proxyprinter.eu').kind).toBe('prod');
  });
  it('detects the develop test instance', () => {
    expect(detectInstance('test.proxyprinter.eu')).toMatchObject({ kind: 'test', label: '[TEST]' });
  });
  it('detects PR environments with their slug', () => {
    expect(detectInstance('f91f75.test.proxyprinter.eu')).toMatchObject({
      kind: 'pr',
      label: '[PR f91f75]',
      favicon: 'proxyprinter-favicon-pr.svg',
    });
  });
  it('detects local', () => {
    expect(detectInstance('localhost').kind).toBe('local');
  });
});
