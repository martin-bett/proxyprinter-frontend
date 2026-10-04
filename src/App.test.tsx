import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/react';
import App from './App';
import { AppThemeProvider } from './theme/ThemeContext';

// jsdom (Jest 27) kennt structuredClone nicht; die Cache-Einträge sind reine JSON-Daten.
if (typeof (global as any).structuredClone !== 'function') {
  (global as any).structuredClone = (value: unknown) => JSON.parse(JSON.stringify(value));
}

test('renders decklist input heading', () => {
  render(
    <AppThemeProvider>
      <App />
    </AppThemeProvider>
  );
  const headingElement = screen.getByText(/Enter Decklist/i);
  expect(headingElement).toBeInTheDocument();
});
