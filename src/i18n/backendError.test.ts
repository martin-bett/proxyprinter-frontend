import { backendErrorText } from './backendError';

describe('backendErrorText', () => {
  it('uses the translated text for a known code and fills the params', () => {
    expect(backendErrorText({ error: 'x', code: 'deckfinder.blocked', params: { host: 'a.com', status: '403' } }))
      .toBe('a.com blocks the request (HTTP 403).');
  });
  it('falls back to the English message for unknown or missing codes', () => {
    expect(backendErrorText({ error: 'Something broke', code: 'nope.unknown' })).toBe('Something broke');
    expect(backendErrorText({ error: 'Plain old error' })).toBe('Plain old error');
  });
  it('returns an empty string for anything else', () => {
    expect(backendErrorText(null)).toBe('');
    expect(backendErrorText('text')).toBe('');
  });
});
