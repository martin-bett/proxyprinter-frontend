import { act, render, screen, waitFor } from '@testing-library/react';
import DeckFinderConfigManager from './DeckFinderConfigManager';
import { refreshAuth, resetAuthForTests } from '../../../service/auth/auth';
import { DeckFinderConfig } from '../../../service/deckfinder/deckFinder';

const config = { id: 7, name: 'archidekt', category: 'MTG', published: true, dataFormat: 'json' } as unknown as DeckFinderConfig;

/** /api/auth/me liefert email, /check liefert owner. */
const mockServer = (email: string | null, owner: boolean) => {
  global.fetch = jest.fn().mockImplementation(async (url: string) => ({
    ok: true,
    json: async () => (String(url).includes('/check') ? owner : { loginEnabled: true, email }),
  })) as any;
};

const login = async (email: string | null, owner = false) => {
  mockServer(email, owner);
  await act(async () => { await refreshAuth(); });
};

describe('DeckFinderConfigManager ownership', () => {
  beforeEach(() => resetAuthForTests());

  it('allows no changes without login and asks for one', async () => {
    await login(null);
    render(<DeckFinderConfigManager configs={[config]} onChanged={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Copy Config/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /new/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Save/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Log in/)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining('/check'), expect.anything());
  });

  it('lets the owner edit once logged in', async () => {
    await login('martin@example.com', true);
    render(<DeckFinderConfigManager configs={[config]} onChanged={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Copy Config/ })).toBeEnabled();
    await waitFor(() => expect(screen.getByRole('button', { name: /Save/ })).toBeInTheDocument());
    expect(screen.queryByText(/Log in/)).not.toBeInTheDocument();
  });

  it('shows no edit buttons on configs of other accounts', async () => {
    await login('martin@example.com', false);
    render(<DeckFinderConfigManager configs={[config]} onChanged={jest.fn()} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/deckfinder/7/check', expect.anything()));
    expect(screen.queryByRole('button', { name: /Save/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy Config/ })).toBeEnabled();
  });
});
