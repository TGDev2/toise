import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders the correct label for draft', () => {
    render(<StatusBadge status="draft" />);
    expect(screen.getByText('Brouillon')).toBeInTheDocument();
  });

  it('renders the correct label for active', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('En cours')).toBeInTheDocument();
  });

  it('renders the correct label for estimated', () => {
    render(<StatusBadge status="estimated" />);
    expect(screen.getByText('Estime')).toBeInTheDocument();
  });

  it('renders the correct label for completed', () => {
    render(<StatusBadge status="completed" />);
    expect(screen.getByText('Terminé')).toBeInTheDocument();
  });
});
