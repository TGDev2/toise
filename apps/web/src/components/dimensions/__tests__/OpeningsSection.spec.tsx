import { render, screen, fireEvent } from '@testing-library/react';
import { OpeningsSection } from '../OpeningsSection';
import type { Opening } from '@/lib/surface';

describe('OpeningsSection', () => {
  const mockAdd = jest.fn();
  const mockUpdate = jest.fn();
  const mockRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders add buttons for doors and windows', () => {
    render(
      <OpeningsSection
        openings={[]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
        grossWallAreaCm2={450000}
      />,
    );
    expect(screen.getByText(/\+ porte/i)).toBeInTheDocument();
    expect(screen.getByText(/\+ fenêtre/i)).toBeInTheDocument();
  });

  it('calls onAdd with door defaults when clicking + Porte', () => {
    render(
      <OpeningsSection
        openings={[]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
        grossWallAreaCm2={450000}
      />,
    );
    fireEvent.click(screen.getByText(/\+ porte/i));
    expect(mockAdd).toHaveBeenCalledWith({
      type: 'door',
      width_cm: 90,
      height_cm: 204,
      count: 1,
    });
  });

  it('calls onAdd with window defaults when clicking + Fenêtre', () => {
    render(
      <OpeningsSection
        openings={[]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
        grossWallAreaCm2={450000}
      />,
    );
    fireEvent.click(screen.getByText(/\+ fenêtre/i));
    expect(mockAdd).toHaveBeenCalledWith({
      type: 'window',
      width_cm: 120,
      height_cm: 100,
      count: 1,
    });
  });

  it('renders the correct number of opening rows', () => {
    const openings: Opening[] = [
      { type: 'door', width_cm: 90, height_cm: 204, count: 1 },
      { type: 'window', width_cm: 120, height_cm: 100, count: 2 },
    ];
    render(
      <OpeningsSection
        openings={openings}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
        grossWallAreaCm2={450000}
      />,
    );
    expect(screen.getByText('Porte')).toBeInTheDocument();
    expect(screen.getByText('Fenêtre')).toBeInTheDocument();
  });

  it('calls onRemove with correct index when delete is clicked', () => {
    const openings: Opening[] = [
      { type: 'door', width_cm: 90, height_cm: 204, count: 1 },
      { type: 'window', width_cm: 120, height_cm: 100, count: 1 },
    ];
    render(
      <OpeningsSection
        openings={openings}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
        grossWallAreaCm2={450000}
      />,
    );
    const deleteButtons = screen.getAllByRole('button', { name: /supprimer/i });
    fireEvent.click(deleteButtons[1]);
    expect(mockRemove).toHaveBeenCalledWith(1);
  });

  it('shows warning when opening area exceeds gross wall area', () => {
    const openings: Opening[] = [
      { type: 'door', width_cm: 9000, height_cm: 20400, count: 1 },
    ];
    render(
      <OpeningsSection
        openings={openings}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
        grossWallAreaCm2={450000}
      />,
    );
    expect(
      screen.getByText(/les dimensions semblent incohérentes/i),
    ).toBeInTheDocument();
  });

  it('does not show warning when opening area is within bounds', () => {
    const openings: Opening[] = [
      { type: 'door', width_cm: 90, height_cm: 204, count: 1 },
    ];
    render(
      <OpeningsSection
        openings={openings}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
        grossWallAreaCm2={450000}
      />,
    );
    expect(
      screen.queryByText(/les dimensions semblent incohérentes/i),
    ).not.toBeInTheDocument();
  });

  it('shows empty state message when no openings', () => {
    render(
      <OpeningsSection
        openings={[]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
        grossWallAreaCm2={450000}
      />,
    );
    expect(screen.getByText(/aucune ouverture ajoutée/i)).toBeInTheDocument();
  });
});
