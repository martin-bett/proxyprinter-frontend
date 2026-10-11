import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminPage from './AdminPage';
import { resetAuthForTests } from '../service/auth/auth';

type Reply = { status?: number; body: unknown };

const serve = (routes: Record<string, Reply | Reply[]>) => {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const route = routes[url];
    const reply = Array.isArray(route) ? (route.length > 1 ? route.shift()! : route[0]) : route;
    const status = reply?.status ?? 200;
    return Promise.resolve({ ok: status < 300, status, json: async () => reply?.body });
  }) as any;
  return calls;
};

const me = { body: { loginEnabled: true, email: 'admin@example.org' } };
const overview = {
  body: {
    settings: [{ key: 'pdf.retention-days', value: 30, defaultValue: 7, min: 1, max: 365, overridden: true }],
    caches: [
      { name: 'searchCache', entries: 12, bytes: 3 * 1024 * 1024, oldest: Date.UTC(2026, 9, 1), setting: null },
      { name: 'pdfs', entries: 2, bytes: 2048, oldest: null, setting: 'pdf.retention-days' },
    ],
  },
};

describe('AdminPage', () => {
  beforeEach(() => resetAuthForTests());

  it('shows settings and caches and saves a new value', async () => {
    const calls = serve({
      '/api/auth/me': me,
      '/api/admin': overview,
      '/api/admin/settings/pdf.retention-days': { body: { key: 'pdf.retention-days', value: 60, defaultValue: 7, min: 1, max: 365, overridden: true } },
    });
    render(<AdminPage />);

    const input = await screen.findByLabelText('Finished PDFs');
    expect(screen.getByText('Server default: 7 days')).toBeInTheDocument();
    expect(screen.getByText('3.0 MB')).toBeInTheDocument();
    expect(screen.getByText('30 days')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '400' } });
    expect(await screen.findByText('Allowed: 1 to 365')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '60' } });
    await waitFor(() => expect(screen.queryByText('Allowed: 1 to 365')).not.toBeInTheDocument());
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    expect(calls.find(c => c.method === 'PUT')).toMatchObject({ url: '/api/admin/settings/pdf.retention-days', body: { value: 60 } });
  });

  it('clears a cache only after confirming and shows backend errors', async () => {
    const calls = serve({
      '/api/auth/me': me,
      '/api/admin': overview,
      '/api/admin/caches/pdfs/clear': { status: 409, body: { error: 'x', code: 'admin.pdfJobsRunning', params: { jobs: 2 } } },
      '/api/admin/caches/searchCache/clear': { body: { deleted: 12 } },
    });
    render(<AdminPage />);

    const clearButtons = await screen.findAllByText('Clear now');
    fireEvent.click(clearButtons[1]);
    expect(calls.some(c => c.method === 'POST')).toBe(false);
    fireEvent.click(screen.getByText('Clear'));
    expect(await screen.findByText('2 PDF jobs are running right now. Try again later.')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Clear now')[0]);
    fireEvent.click(screen.getByText('Clear'));
    expect(await screen.findByText('12 entries deleted.')).toBeInTheDocument();
  });

  it('shows usage per day with totals and hides it for older backends', async () => {
    serve({
      '/api/auth/me': me,
      '/api/admin': { body: { ...overview.body, usage: {
        days: [{ day: '2026-10-11', counts: { pageViews: 1234, visitors: 56 } }, { day: '2026-10-10', counts: {} }],
        totals: { pageViews: 99999, decks: 7 },
      } } },
    });
    const { unmount } = render(<AdminPage />);

    expect(await screen.findByText('Usage')).toBeInTheDocument();
    // Zwei ausklappbare Sektionen, Nutzung unter den Cache-Einstellungen
    const toggles = screen.getAllByRole('button', { expanded: true });
    expect(toggles.map(b => b.textContent)).toEqual(['Cache settings', 'Usage']);
    fireEvent.click(toggles[0]);
    expect(screen.getByRole('button', { name: 'Cache settings' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Cache settings' }));
    expect(screen.getByText('Page views')).toBeInTheDocument();
    expect(screen.getByText('99,999')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText(new Date(Date.UTC(2026, 9, 11)).toLocaleDateString('en', { timeZone: 'UTC' }))).toBeInTheDocument();
    unmount();

    resetAuthForTests();
    serve({ '/api/auth/me': me, '/api/admin': overview });
    render(<AdminPage />);
    expect(await screen.findByText('Caches')).toBeInTheDocument();
    expect(screen.queryByText('Usage')).not.toBeInTheDocument();
  });

  it('shows backend values first', async () => {
    serve({
      '/api/auth/me': me,
      '/api/admin': { body: { ...overview.body, usage: { days: [], totals: {} }, system: {
        database: 'UP', startedAt: Date.UTC(2026, 9, 10), uptimeMs: 93_784_000, javaVersion: '25', 
        systemLoad: -1, heapUsed: 512 * 1024 * 1024, heapCommitted: 768 * 1024 * 1024, heapMax: 2 * 1024 * 1024 * 1024,
        nonHeapUsed: 100 * 1024 * 1024, threads: 42, diskFree: 10 * 1024 ** 3, diskTotal: 50 * 1024 ** 3,
        pdfJobsActive: 1, pdfJobsQueued: 3, pdfJobsMax: 2,
      } } },
    });
    render(<AdminPage />);

    expect(await screen.findByText('Reachable')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { expanded: true }).map(b => b.textContent))
      .toEqual(['Backend', 'Cache settings', 'Usage']);
    expect(screen.getByText('1 d 2 h 3 min')).toBeInTheDocument();
    expect(screen.getByText('512 MB of 2.0 GB')).toBeInTheDocument();
    expect(screen.getByText('10 GB free of 50 GB')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 running, 3 waiting')).toBeInTheDocument();
  });

  it('asks for login without a session and says so for other accounts', async () => {
    serve({ '/api/auth/me': { body: { loginEnabled: true } }, '/api/admin': { status: 401, body: {} } });
    const { unmount } = render(<AdminPage />);
    expect(await screen.findByText(/needs an admin account/)).toBeInTheDocument();
    unmount();

    resetAuthForTests();
    serve({ '/api/auth/me': { body: { loginEnabled: true, email: 'user@example.org' } }, '/api/admin': { status: 403, body: {} } });
    render(<AdminPage />);
    expect(await screen.findByText('user@example.org has no admin rights.')).toBeInTheDocument();
  });
});
