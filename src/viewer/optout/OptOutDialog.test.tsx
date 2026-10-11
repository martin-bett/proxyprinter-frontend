import { fireEvent, render, screen } from '@testing-library/react';
import OptOutDialog from './OptOutDialog';

type Reply = { status?: number; body: unknown };

const serve = (routes: Record<string, Reply | Reply[]>) => {
  const calls: { url: string; body?: unknown }[] = [];
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const route = routes[url];
    const reply = Array.isArray(route) ? route.shift()! : route;
    const status = reply?.status ?? 200;
    return Promise.resolve({ ok: status < 300, status, json: async () => reply?.body });
  }) as any;
  return calls;
};

const info = { body: { mail: true, mailboxes: ['admin', 'webmaster'] } };

describe('OptOutDialog', () => {
  it('sends the confirmation mail to the chosen mailbox', async () => {
    const calls = serve({
      '/api/blocklist/info': info,
      '/api/blocklist/request': { body: { status: 'sent', host: 'example.com', email: 'webmaster@example.com' } },
    });
    render(<OptOutDialog open onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Domain or IP'), { target: { value: 'https://Example.com/cards' } });
    expect(await screen.findByText('@example.com')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Mailbox'), { target: { value: 'webmaster' } });
    fireEvent.click(screen.getByText('Send confirmation mail'));

    expect(await screen.findByText(/A confirmation link was sent to webmaster@example.com/)).toBeInTheDocument();
    expect(calls.find(c => c.url === '/api/blocklist/request')!.body)
      .toMatchObject({ host: 'https://Example.com/cards', method: 'mail', mailbox: 'webmaster' });
  });

  it('shows DNS record and file and checks them', async () => {
    serve({
      '/api/blocklist/info': { body: { mail: false, mailboxes: [] } },
      '/api/blocklist/request': { body: { status: 'challenge', host: 'example.com', token: 'tok', dnsName: '_proxyprinter-verify.example.com', dnsValue: 'proxyprinter-verify=tok', fileUrl: 'https://example.com/.well-known/proxyprinter-verify.txt' } },
      '/api/blocklist/verify': [
        { status: 409, body: { error: 'x', code: 'blocklist.notVerified', params: { host: 'example.com' } } },
        { body: { status: 'blocked', host: 'example.com' } },
      ],
    });
    render(<OptOutDialog open onClose={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Domain or IP'), { target: { value: 'example.com' } });
    expect(await screen.findByText(/Not available right now/)).toBeInTheDocument();
    fireEvent.click(await screen.findByText('Get token'));

    expect(await screen.findByText('_proxyprinter-verify.example.com')).toBeInTheDocument();
    expect(screen.getByText('proxyprinter-verify=tok')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Check now'));
    expect(await screen.findByText('Neither the DNS record nor the file for example.com contains the token yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Check now'));
    expect(await screen.findByText('example.com is now blocked as a source.')).toBeInTheDocument();
  });

  it('redeems the token from the mail link right away', async () => {
    const calls = serve({
      '/api/blocklist/info': info,
      '/api/blocklist/verify': { body: { status: 'blocked', host: 'example.com' } },
    });
    render(<OptOutDialog open onClose={() => undefined} linkToken="abc" />);
    expect(await screen.findByText('example.com is now blocked as a source.')).toBeInTheDocument();
    expect(calls.find(c => c.url === '/api/blocklist/verify')!.body).toEqual({ token: 'abc' });
  });
});
