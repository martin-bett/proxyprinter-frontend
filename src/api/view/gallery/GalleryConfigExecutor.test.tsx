import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import GalleryConfigExecutor from './GallerConfigExecutor';
import { GalleryConfig } from '../../../service/ApiFactory';

const config = {
  id: 1,
  name: 'reddit',
  parameterMap: { url: { url: '$GALLERY_INPUT$' }, request: { raw_json: '1' } },
} as unknown as GalleryConfig;

describe('GalleryConfigExecutor', () => {
  it('zeigt Hinweis und ein Feld je $GALLERY_INPUT$ und übergibt die Eingabe', () => {
    const handleExecute = jest.fn();
    render(<GalleryConfigExecutor config={config} handleExecute={handleExecute} status={{ loading: false }} onDismissError={() => {}} />);

    expect(screen.getByText(/Paste the gallery link/)).toBeInTheDocument();
    // Nur der Eingabe-Platzhalter wird zum Feld, feste Parameter nicht
    expect(screen.getAllByRole('textbox')).toHaveLength(1);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'https://example.org/g/1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));

    expect(handleExecute).toHaveBeenCalledWith(expect.objectContaining({
      parameterMap: { url: { url: 'https://example.org/g/1' }, request: { raw_json: '1' } },
    }));
  });

  it('sperrt Execute während des Ladens', () => {
    render(<GalleryConfigExecutor config={config} handleExecute={jest.fn()} status={{ loading: true }} onDismissError={() => {}} />);
    expect(screen.getByRole('button', { name: 'Execute' })).toBeDisabled();
  });

  it('bittet ohne gewählte Galerie um eine Auswahl', () => {
    render(<GalleryConfigExecutor config={null} handleExecute={jest.fn()} status={{ loading: false }} onDismissError={() => {}} />);
    expect(screen.getByText('Select a gallery above to run it.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
