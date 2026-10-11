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

  it('asks for login without a session and says so for other accounts', async () => {
    serve({ '/api/auth/me': { body: { loginEnabled: true } }, '/api/admin': { status: 401, body: {} } });
    const { unmount } = render(<AdminPage />);
    expect(await screen.findByText(/needs an admin account/)).toBeInTheDocument();
    unmount();

    resetAuthForTests();
    serve({ '/api/auth/me': { body: { loginEnabled: true, email: 'user@example.org' } }, '/api/admin': { status: 403, body: {} } });
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText('user@example.org has no admin rights.')).toBeInTheDocument());
  });
});
