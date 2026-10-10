import { backendErrorText, responseErrorText } from './backendError';

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

describe('responseErrorText', () => {
  const json = (body: unknown) => ({ json: async () => body } as unknown as Response);
  it('translates the blocklist code', async () => {
    expect(await responseErrorText(json({ error: 'x', code: 'blocklist.blockedHost', params: { host: 'api.example.com' } }), 'fallback'))
      .toBe('api.example.com is blocked at the request of its operator.');
  });
  it('uses the fallback without a JSON body', async () => {
    const broken = { json: async () => { throw new Error('no json'); } } as unknown as Response;
    expect(await responseErrorText(broken, 'fallback')).toBe('fallback');
  });
});
