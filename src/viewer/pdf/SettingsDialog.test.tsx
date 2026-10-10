import { act, fireEvent, render, screen } from '@testing-library/react';
import { SettingsDialog, defaultSettings } from './SettingsDialog';
import { refreshAuth, resetAuthForTests } from '../../service/auth/auth';

const login = async (email: string | null) => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ loginEnabled: true, email }) }) as any;
  await act(async () => { await refreshAuth(); });
};

const renderDialog = (mailEnabled: boolean) => {
  const onSettingsChange = jest.fn();
  const onClose = jest.fn();
  render(<SettingsDialog open onClose={onClose} settings={defaultSettings} onSettingsChange={onSettingsChange} mailEnabled={mailEnabled} />);
  return { onSettingsChange, onClose, box: screen.getByRole('checkbox', { name: /download link/i }) as HTMLInputElement };
};

describe('SettingsDialog mail option', () => {
  beforeEach(() => resetAuthForTests());

  it('asks for a login when nobody is logged in', async () => {
    await login(null);
    const { box } = renderDialog(true);
    expect(box).toBeDisabled();
    expect(screen.getByText(/Log in/)).toBeInTheDocument();
  });

  it('shows the account address and saves the choice when logged in', async () => {
    await login('martin@example.com');
    const { onSettingsChange, box } = renderDialog(true);
    expect(screen.getByText(/martin@example.com/)).toBeInTheDocument();

    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: 'Ok' }));
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ sendMail: true }));
  });

  it('is disabled when the server cannot send mails', async () => {
    await login('martin@example.com');
    const { box } = renderDialog(false);
    expect(box).toBeDisabled();
    expect(screen.getByText(/not set up/i)).toBeInTheDocument();
  });
});

describe('SettingsDialog preview', () => {
  it('shows the slot count and updates it with the dimensions', () => {
    render(<SettingsDialog open onClose={jest.fn()} settings={defaultSettings} onSettingsChange={jest.fn()} />);
    expect(screen.getByText(/3 × 3 = 9/)).toBeInTheDocument();
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '90' } });
    expect(screen.getByText(/2 × 3 = 6/)).toBeInTheDocument();
  });
});

describe('SettingsDialog corner size', () => {
  const renderCorners = () => {
    const onSettingsChange = jest.fn();
    render(<SettingsDialog open onClose={jest.fn()} settings={{ ...defaultSettings, corners: true }} onSettingsChange={onSettingsChange} />);
    return { onSettingsChange, input: screen.getByLabelText(/Corner Size/) as HTMLInputElement };
  };

  it('is empty (automatic) by default and leaves the field out of the settings', () => {
    const { onSettingsChange, input } = renderCorners();
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('auto (2.6)');
    fireEvent.click(screen.getByRole('button', { name: 'Ok' }));
    expect(onSettingsChange.mock.calls[0][0]).not.toHaveProperty('cornerSize');
  });

  it('saves a corner size in mm and drops it again when cleared', () => {
    const { onSettingsChange, input } = renderCorners();
    fireEvent.change(input, { target: { value: '3.2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ok' }));
    expect(onSettingsChange).toHaveBeenLastCalledWith(expect.objectContaining({ cornerSize: 3.2 }));

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ok' }));
    expect(onSettingsChange.mock.calls[1][0]).not.toHaveProperty('cornerSize');
  });
});
