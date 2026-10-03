import { render, screen } from '@testing-library/react';
import App from './App';

test('renders decklist input heading', () => {
  render(<App />);
  const headingElement = screen.getByText(/Enter Decklist/i);
  expect(headingElement).toBeInTheDocument();
});
