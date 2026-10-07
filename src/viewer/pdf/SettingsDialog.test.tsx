import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsDialog, defaultSettings } from './SettingsDialog';

const renderDialog = (mailEnabled: boolean) => {
  const onSettingsChange = jest.fn();
  const onClose = jest.fn();
  render(<SettingsDialog open onClose={onClose} settings={defaultSettings} onSettingsChange={onSettingsChange} mailEnabled={mailEnabled} />);
  return { onSettingsChange, onClose, input: screen.getByLabelText(/download link/i) as HTMLInputElement };
};

describe('SettingsDialog email field', () => {
  it('blocks saving an invalid address and saves a trimmed valid one', () => {
    const { onSettingsChange, input } = renderDialog(true);
    const ok = screen.getByRole('button', { name: 'Ok' });

    fireEvent.change(input, { target: { value: 'martin@' } });
    expect(ok).toBeDisabled();
    expect(screen.getByText(/valid email address/i)).toBeInTheDocument();

    fireEvent.change(input, { target: { value: ' martin@example.com ' } });
    expect(ok).toBeEnabled();
    fireEvent.click(ok);
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ email: 'martin@example.com' }));
  });

  it('is disabled when the server cannot send mails', () => {
    const { input } = renderDialog(false);
    expect(input).toBeDisabled();
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
