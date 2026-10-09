import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SearchLogPanel from './SearchLogPanel';

describe('SearchLogPanel', () => {
  it('rendert geschlossen nichts', () => {
    const { container } = render(<SearchLogPanel open={false} entries={[]} onShowRaw={() => {}} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('zeigt Titel und Anzahl und schließt per Button und Escape', () => {
    const onClose = jest.fn();
    render(<SearchLogPanel open entries={[]} onShowRaw={() => {}} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Search Log' });
    expect(dialog).toHaveTextContent('0 entries');
    fireEvent.click(screen.getByLabelText('Close'));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
