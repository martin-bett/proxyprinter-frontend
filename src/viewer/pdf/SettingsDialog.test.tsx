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

describe('SettingsDialog dimensions', () => {
  it('defaults to real card size and edits whole and tenth millimetres separately', () => {
    const onSettingsChange = jest.fn();
    render(<SettingsDialog open onClose={jest.fn()} settings={defaultSettings} onSettingsChange={onSettingsChange} />);
    const width = screen.getByLabelText(/Width/) as HTMLInputElement;
    const widthTenth = screen.getAllByLabelText('Tenths of a millimetre')[0] as HTMLInputElement;
    expect(width.value).toBe('63');
    expect(widthTenth.value).toBe('5');

    fireEvent.change(width, { target: { value: '62' } });
    fireEvent.change(widthTenth, { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ok' }));
    expect(onSettingsChange).toHaveBeenLastCalledWith(expect.objectContaining({ width: 62.8, height: 88.9 }));
  });
});

describe('SettingsDialog closing', () => {
  it('keeps the changes when the dialog closes without Ok (click beside it)', () => {
    const onSettingsChange = jest.fn();
    const { unmount } = render(<SettingsDialog open onClose={jest.fn()} settings={defaultSettings} onSettingsChange={onSettingsChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Corners/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Cutlines/ }));
    unmount();
    expect(onSettingsChange).toHaveBeenLastCalledWith(expect.objectContaining({ corners: true, cutlines: true }));
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
    return {
      onSettingsChange,
      input: screen.getByLabelText(/Corner Size/) as HTMLInputElement,
      auto: screen.getByRole('checkbox', { name: 'Original ratio' }) as HTMLInputElement,
    };
  };

  it('is automatic by default: checked, input locked with the computed size, field left out', () => {
    const { onSettingsChange, input, auto } = renderCorners();
    expect(auto).toBeChecked();
    expect(input).toBeDisabled();
    expect(input.value).toBe('3');
    expect((screen.getAllByLabelText('Tenths of a millimetre').pop() as HTMLInputElement).value).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'Ok' }));
    expect(onSettingsChange.mock.calls[0][0]).not.toHaveProperty('cornerSize');
  });

  it('saves a manual corner size and drops it again when automatic is checked', () => {
    const { onSettingsChange, input, auto } = renderCorners();
    fireEvent.click(auto);
    expect(input).toBeEnabled();
    fireEvent.change(input, { target: { value: '4' } });
    fireEvent.change(screen.getAllByLabelText('Tenths of a millimetre').pop()!, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ok' }));
    expect(onSettingsChange).toHaveBeenLastCalledWith(expect.objectContaining({ cornerSize: 4.5 }));

    fireEvent.click(auto);
    fireEvent.click(screen.getByRole('button', { name: 'Ok' }));
    expect(onSettingsChange.mock.calls[1][0]).not.toHaveProperty('cornerSize');
  });
});
