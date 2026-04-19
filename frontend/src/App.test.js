import { render, screen } from '@testing-library/react';
import App from './App';

test('renders KaamSetu brand name', () => {
  render(<App />);
  const brandElement = screen.getByText(/KaamSetu/i);
  expect(brandElement).toBeInTheDocument();
});

test('renders navigation links', () => {
  render(<App />);
  const findJobsLink = screen.getByText(/Find Jobs/i);
  expect(findJobsLink).toBeInTheDocument();
});
