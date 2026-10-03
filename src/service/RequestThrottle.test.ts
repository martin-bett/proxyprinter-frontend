import { throttledFetch } from './RequestThrottle';

const ok = (body = '{}') => new Response(body, { status: 200 });

describe('throttledFetch', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('hält Abstand zwischen Scryfall-Suchen ein', async () => {
    const times: number[] = [];
    global.fetch = jest.fn(async () => { times.push(Date.now()); return ok(); }) as any;
    await Promise.all(['a', 'b', 'c'].map(q =>
      throttledFetch(`https://api.scryfall.com/cards/search?q=${q}`)));
    expect(times).toHaveLength(3);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(500);
    expect(times[2] - times[1]).toBeGreaterThanOrEqual(500);
  });

  it('wiederholt nach 429 mit Retry-After', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '0.05' } }))
      .mockResolvedValueOnce(ok('{"data":[]}'));
    global.fetch = fetchMock as any;
    const res = await throttledFetch('https://example.org/retry');
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bündelt identische gleichzeitige Requests', async () => {
    const fetchMock = jest.fn(async () => ok('{"x":1}'));
    global.fetch = fetchMock as any;
    const [a, b] = await Promise.all([
      throttledFetch('https://example.org/same'),
      throttledFetch('https://example.org/same'),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await a.json()).toEqual({ x: 1 });
    expect(await b.json()).toEqual({ x: 1 });
  });
});
