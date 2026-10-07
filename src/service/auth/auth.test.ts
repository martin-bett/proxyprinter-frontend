import {
  deleteAccount, handleLoginLink, logout, refreshAuth, requestLogin, resetAuthForTests, verifyCode,
} from './auth';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from './auth';

const respond = (status: number, body?: unknown) =>
  jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body }) as any;

describe('auth', () => {
  beforeEach(() => resetAuthForTests());

  it('loads the session from /api/auth/me', async () => {
    global.fetch = respond(200, { loginEnabled: true, email: 'a@b.de' });
    const { result } = renderHook(() => useAuth());
    expect(result.current.loaded).toBe(false);
    await act(async () => { await refreshAuth(); });
    expect(result.current).toEqual({ loaded: true, loginEnabled: true, email: 'a@b.de' });
  });

  it('treats a failing server as logged out', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('down')) as any;
    const { result } = renderHook(() => useAuth());
    await act(async () => { await refreshAuth(); });
    expect(result.current).toEqual({ loaded: true, loginEnabled: false, email: null });
  });

  it('maps login request answers', async () => {
    global.fetch = respond(200);
    expect(await requestLogin(' a@b.de ')).toBe('sent');
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual({ email: 'a@b.de' });
    global.fetch = respond(400);
    expect(await requestLogin('x')).toBe('invalid');
    global.fetch = respond(429);
    expect(await requestLogin('a@b.de')).toBe('rate-limited');
    global.fetch = respond(503);
    expect(await requestLogin('a@b.de')).toBe('disabled');
  });

  it('logs in with a code and logs out', async () => {
    const { result } = renderHook(() => useAuth());
    global.fetch = respond(200, { loginEnabled: true, email: 'a@b.de' });
    let ok = false;
    await act(async () => { ok = await verifyCode('a@b.de', ' 123456 '); });
    expect(ok).toBe(true);
    expect(result.current.email).toBe('a@b.de');
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual({ email: 'a@b.de', code: '123456' });

    global.fetch = respond(204);
    await act(async () => { await logout(); });
    expect(result.current.email).toBeNull();
  });

  it('keeps the login after a wrong code', async () => {
    global.fetch = respond(401);
    expect(await verifyCode('a@b.de', '000000')).toBe(false);
  });

  it('redeems ?login= from the URL and removes it', async () => {
    window.history.replaceState(null, '', '/?x=1&login=tok123');
    global.fetch = respond(200, { loginEnabled: true, email: 'a@b.de' });
    expect(await handleLoginLink()).toBe(true);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual({ token: 'tok123' });
    expect(window.location.search).toBe('?x=1');
  });

  it('does nothing without a login parameter', async () => {
    window.history.replaceState(null, '', '/');
    global.fetch = respond(200);
    expect(await handleLoginLink()).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('deleteAccount reports failure', async () => {
    global.fetch = respond(500);
    expect(await deleteAccount()).toBe(false);
  });
});
