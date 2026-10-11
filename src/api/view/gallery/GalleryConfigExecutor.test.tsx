import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import GalleryConfigExecutor from './GallerConfigExecutor';
import { GalleryConfig, localizedHint } from '../../../service/ApiFactory';

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

  it('zeigt den Hinweis der Config statt des generischen Textes', () => {
    const withHint = { ...config, hint: 'Paste the Reddit post link' } as GalleryConfig;
    render(<GalleryConfigExecutor config={withHint} handleExecute={jest.fn()} status={{ loading: false }} onDismissError={() => {}} />);
    expect(screen.getByText('Paste the Reddit post link')).toBeInTheDocument();
    expect(screen.queryByText(/Paste the gallery link/)).not.toBeInTheDocument();
  });
});

describe('localizedHint', () => {
  const hinted = { hint: 'Original', hintTranslations: { de: 'Deutsch' } } as unknown as GalleryConfig;

  it('nimmt die Übersetzung der UI-Sprache, auch bei Regionalcode', () => {
    expect(localizedHint(hinted, 'de')).toBe('Deutsch');
    expect(localizedHint(hinted, 'de-AT')).toBe('Deutsch');
  });

  it('fällt auf den Originaltext zurück, ohne Hinweis auf undefined', () => {
    expect(localizedHint(hinted, 'fr')).toBe('Original');
    expect(localizedHint({} as GalleryConfig, 'de')).toBeUndefined();
  });
});
