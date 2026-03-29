import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteConfirmDialog } from '../DeleteConfirmDialog';

describe('DeleteConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    projectName: 'Mon projet',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    isDeleting: false,
  };

  it('renders nothing when not open', () => {
    const { container } = render(
      <DeleteConfirmDialog {...defaultProps} isOpen={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('displays the project name', () => {
    render(<DeleteConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Mon projet')).toBeInTheDocument();
  });

  it('displays the 30-day retention message', () => {
    render(<DeleteConfirmDialog {...defaultProps} />);
    expect(
      screen.getByText(/conserve pendant 30 jours/),
    ).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    render(<DeleteConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Confirmer la suppression'));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<DeleteConfirmDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Annuler'));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows loading state when deleting', () => {
    render(<DeleteConfirmDialog {...defaultProps} isDeleting={true} />);
    expect(screen.getByText('Suppression...')).toBeInTheDocument();
  });
});
