import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImageSelectDialog from './ImageSelectDialog';
import { CardResult } from '../../api/types/types';

jest.mock('./CardImage', () => ({
  __esModule: true,
  // Kachel meldet "lade..." als laufenden Download, alles andere als fertig
  default: ({ cardInput, onTileState }: { cardInput: CardResult; onTileState?: (s: string) => void }) => {
    const { useEffect } = require('react');
    useEffect(() => {
      onTileState?.(cardInput.name.startsWith('lade') ? 'loading' : 'done');
      return () => onTileState?.(null as unknown as string);
    }, [cardInput.name]);
    return <div data-testid="card">{cardInput.name}</div>;
  },
}));
jest.mock('../../container/CropImageOverlay', () => ({ __esModule: true, default: () => null }));
jest.mock('../../service/cache/ImageLoaderService', () => ({
  imageLoaderService: {
    stopByCategory: jest.fn(),
    // Keine jest.fn: CRA setzt Mocks vor jedem Test zurück
    getCacheStatsForCardName: () => Promise.resolve({ count: 0, bytes: 0 }),
    getDownloadRate: () => 1.5 * 1024 * 1024,
    clearCacheForCardName: jest.fn(),
  },
}));

const card = (name: string, rating?: 'good' | 'ok' | 'poor' | 'unknown', languageCode?: string, apiName = 'scryfall') =>
  ({
    name,
    apiName,
    languageCode,
    imageUrl: `https://example.org/${name}.jpg`,
    cropSettings: {},
    imageInfo: rating ? { quality: { rating, sharpness: 0, effectiveDpi: 0, edgeCoverage: 0, contrast: 0 } } : undefined,
  }) as unknown as CardResult;

const shown = () => screen.queryAllByTestId('card').map(e => e.textContent);

it('blendet Bilder nach Druckschärfe aus', () => {
  render(
    <ImageSelectDialog
      open={true}
      onClose={() => {}}
      groupedResults={{ scryfall: [card('scharf', 'good'), card('weich', 'ok'), card('matsch', 'poor'), card('neu')] }}
      initialSelectedImage={null}
      onImageLoadError={() => {}}
      initialVisibleLanguages={new Set(['No Language'])}
      initialVisibleApis={new Set(['scryfall'])}
    />
  );
  expect(shown()).toEqual(['scharf', 'weich', 'matsch', 'neu']);

  fireEvent.click(screen.getByLabelText(/^Schlecht lesbar/));
  expect(shown()).toEqual(['scharf', 'weich', 'neu']);

  fireEvent.click(screen.getByLabelText(/^Etwas weich/));
  fireEvent.click(screen.getByLabelText(/^Nicht bewertet/));
  expect(shown()).toEqual(['scharf']);
});

const countOf = (id: string) =>
  document.getElementById(id)!.closest('label')!.querySelector('.filter-count')!.textContent;

it('zeigt an jedem Filterwert, wie viele Bilder dahinter stecken', () => {
  render(
    <ImageSelectDialog
      open={true}
      onClose={() => {}}
      groupedResults={{
        scryfall: [card('a', 'good', 'en'), card('b', 'poor', 'de'), card('c', undefined, 'en')],
        mpc: [card('d', 'good', 'en', 'mpc'), card('e', 'good', undefined, 'mpc')],
      }}
      initialSelectedImage={null}
      onImageLoadError={() => {}}
      initialVisibleLanguages={new Set(['No Language', 'en', 'de'])}
      initialVisibleApis={new Set(['scryfall', 'mpc'])}
    />
  );
  expect(countOf('select-lang-en')).toBe('3');
  expect(countOf('select-lang-de')).toBe('1');
  expect(countOf('select-lang-No Language')).toBe('1');
  expect(countOf('select-api-scryfall')).toBe('3');
  expect(countOf('select-api-mpc')).toBe('2');
  expect(countOf('select-quality-good')).toBe('3');
  expect(countOf('select-quality-unrated')).toBe('1');

  // Die anderen Gruppen zählen mit: ohne mpc bleiben weniger englische und gute Bilder
  fireEvent.click(screen.getByLabelText(/^mpc/));
  expect(countOf('select-lang-en')).toBe('2');
  expect(countOf('select-quality-good')).toBe('1');
  // Die eigene Gruppe nicht: mpc zeigt weiter, was beim Einschalten dazukäme
  expect(countOf('select-api-mpc')).toBe('2');
});

it('zählt Downloads und fertige Kacheln in der Zeile oben', async () => {
  render(
    <ImageSelectDialog
      open={true}
      onClose={() => {}}
      groupedResults={{ scryfall: [card('lade1'), card('lade2'), card('fertig'), card('fertig2')] }}
      initialSelectedImage={null}
      onImageLoadError={() => {}}
      initialVisibleLanguages={new Set(['No Language'])}
      initialVisibleApis={new Set(['scryfall'])}
    />
  );
  await waitFor(() => expect(screen.getByTitle('Loaded').textContent).toContain('2'));
  expect(screen.getByTitle(/^Downloading/).textContent).toContain('2');
  expect(screen.getByTitle('Queued').textContent).toContain('0');
  // Hinweis der Downloads nennt die gebündelte Rate, solange etwas lädt
  await waitFor(() => expect(screen.getByTitle('Downloading · 1.5 MB/s')).toBeTruthy());
});

describe('Blättern zur nächsten/vorherigen Karte im Deck', () => {
  const renderWithNav = (position: number, onStep = jest.fn()) => {
    render(
      <ImageSelectDialog
        open={true}
        onClose={() => {}}
        groupedResults={{ scryfall: [card('a', 'good', 'en'), card('b', 'good', 'en')] }}
        initialSelectedImage={null}
        onImageLoadError={() => {}}
        initialVisibleLanguages={new Set(['en'])}
        initialVisibleApis={new Set(['scryfall'])}
        deckNav={{ key: `k${position}`, cardName: 'Test', position, total: 3, onStep }}
      />
    );
    return onStep;
  };

  it('Pfeiltasten blättern ohne Auswahl mit null', () => {
    const onStep = renderWithNav(2);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onStep).toHaveBeenLastCalledWith(1, null);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onStep).toHaveBeenLastCalledWith(-1, null);
  });

  it('gibt ein im Dialog angeklicktes Bild beim Blättern mit', () => {
    const onStep = renderWithNav(2);
    fireEvent.click(screen.getByText('b'));
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onStep).toHaveBeenLastCalledWith(1, expect.objectContaining({ name: 'b' }));
  });

  it('blättert nicht über das Deckende hinaus', () => {
    const onStep = renderWithNav(1);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onStep).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Previous card') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Next card') as HTMLButtonElement).disabled).toBe(false);
  });

  it('die Pfeil-Buttons blättern', () => {
    const onStep = renderWithNav(2);
    fireEvent.click(screen.getByLabelText('Next card'));
    expect(onStep).toHaveBeenLastCalledWith(1, null);
    fireEvent.click(screen.getByLabelText('Previous card'));
    expect(onStep).toHaveBeenLastCalledWith(-1, null);
  });

  it('Pfeiltasten in Eingabefeldern blättern nicht', () => {
    const onStep = renderWithNav(2);
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(onStep).not.toHaveBeenCalled();
    input.remove();
  });
});
