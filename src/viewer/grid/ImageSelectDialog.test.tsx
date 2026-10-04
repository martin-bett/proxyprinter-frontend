import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageSelectDialog from './ImageSelectDialog';
import { CardResult } from '../../api/types/types';

jest.mock('./CardImage', () => ({
  __esModule: true,
  default: ({ cardInput }: { cardInput: CardResult }) => <div data-testid="card">{cardInput.name}</div>,
}));
jest.mock('../../container/CropImageOverlay', () => ({ __esModule: true, default: () => null }));
jest.mock('../../service/cache/ImageLoaderService', () => ({
  imageLoaderService: { stopForFilters: jest.fn(), stopByCategory: jest.fn() },
}));

const card = (name: string, rating?: 'good' | 'ok' | 'poor' | 'unknown') =>
  ({
    name,
    apiName: 'scryfall',
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
      groupedResults={{ scryfall: [card('scharf', 'good'), card('weich', 'ok'), card('matsch', 'poor'), card('ohneText', 'unknown'), card('neu')] }}
      initialSelectedImage={null}
      onImageLoadError={() => {}}
      initialVisibleLanguages={new Set(['No Language'])}
      initialVisibleApis={new Set(['scryfall'])}
    />
  );
  expect(shown()).toEqual(['scharf', 'weich', 'matsch', 'ohneText', 'neu']);

  fireEvent.click(screen.getByLabelText('Schlecht lesbar'));
  expect(shown()).toEqual(['scharf', 'weich', 'ohneText', 'neu']);

  // Noch nicht gemessene Bilder bleiben sichtbar, damit sie geladen werden
  fireEvent.click(screen.getByLabelText('Etwas weich'));
  fireEvent.click(screen.getByLabelText('Nicht bewertet'));
  expect(shown()).toEqual(['scharf', 'neu']);
});
