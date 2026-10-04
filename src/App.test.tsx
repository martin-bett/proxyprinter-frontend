import 'fake-indexeddb/auto';
import { act, render, screen } from '@testing-library/react';
import App from './App';
import { AppThemeProvider } from './theme/ThemeContext';
import { imageLoaderService } from './service/cache/ImageLoaderService';

// jsdom (Jest 27) kennt structuredClone nicht; die Cache-Einträge sind reine JSON-Daten.
if (typeof (global as any).structuredClone !== 'function') {
  (global as any).structuredClone = (value: unknown) => JSON.parse(JSON.stringify(value));
}

test('renders decklist input heading', async () => {
  render(
    <AppThemeProvider>
      <App />
    </AppThemeProvider>
  );
  const headingElement = screen.getByText(/Enter Decklist/i);
  expect(headingElement).toBeInTheDocument();
  // Cache-Initialisierung (IndexedDB) abwarten, sonst loggt sie nach Testende und Jest schlägt fehl
  await act(() => imageLoaderService.ready);
});
