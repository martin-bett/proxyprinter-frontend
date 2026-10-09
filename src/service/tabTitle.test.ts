import { setLoadingProgressTitle } from './tabTitle';

describe('setLoadingProgressTitle', () => {
  afterEach(() => {
    setLoadingProgressTitle(null);
  });

  it('shows progress before ProxyPrinter', () => {
    document.title = 'ProxyPrinter';
    setLoadingProgressTitle(45);
    expect(document.title).toBe('45% ProxyPrinter');
  });

  it('keeps the instance prefix in front of the progress', () => {
    document.title = '[TEST] ProxyPrinter';
    setLoadingProgressTitle(7);
    expect(document.title).toBe('[TEST] 7% ProxyPrinter');
  });

  it('restores the title without progress when loading ends', () => {
    document.title = '[PR 153d5e] ProxyPrinter';
    setLoadingProgressTitle(0);
    setLoadingProgressTitle(100);
    setLoadingProgressTitle(null);
    expect(document.title).toBe('[PR 153d5e] ProxyPrinter');
  });
});
