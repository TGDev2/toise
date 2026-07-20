import { render, screen, fireEvent } from '@testing-library/react';
import { ExclusionsSection } from '../ExclusionsSection';
import type { SurfaceExclusion } from '@/lib/surface';

describe('ExclusionsSection', () => {
  const mockAdd = jest.fn();
  const mockUpdate = jest.fn();
  const mockRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders quick-add buttons for the four exclusion types', () => {
    render(
      <ExclusionsSection
        exclusions={[]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
        netWallAreaCm2={450000}
      />,
    );
    expect(screen.getByText(/\+ crédence/i)).toBeInTheDocument();
    expect(screen.getByText(/\+ demi-mur/i)).toBeInTheDocument();
    expect(screen.getByText(/\+ plinthes/i)).toBeInTheDocument();
    expect(screen.getByText(/\+ autre/i)).toBeInTheDocument();
  });

  it('calls onAdd with credence defaults when clicking + Crédence', () => {
    render(
      <ExclusionsSection
        exclusions={[]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
        netWallAreaCm2={450000}
      />,
    );
    fireEvent.click(screen.getByText(/\+ crédence/i));
    expect(mockAdd).toHaveBeenCalledWith({
      surface_target: 'wall',
      type: 'credence',
      area_m2: 2,
    });
  });

  it('renders one row per exclusion with its type label', () => {
    const exclusions: SurfaceExclusion[] = [
      { surface_target: 'wall', type: 'credence', area_m2: 2 },
      { surface_target: 'wall', type: 'half_wall', area_m2: 3 },
    ];
    render(
      <ExclusionsSection
        exclusions={exclusions}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
        netWallAreaCm2={450000}
      />,
    );
    expect(screen.getByText('Crédence')).toBeInTheDocument();
    expect(screen.getByText('Demi-mur')).toBeInTheDocument();
  });

  it('only shows the description input for the "other" type', () => {
    const exclusions: SurfaceExclusion[] = [
      { surface_target: 'wall', type: 'credence', area_m2: 2 },
      { surface_target: 'wall', type: 'other', area_m2: 1 },
    ];
    render(
      <ExclusionsSection
        exclusions={exclusions}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
        netWallAreaCm2={450000}
      />,
    );
    expect(screen.getAllByLabelText(/description/i)).toHaveLength(1);
  });

  it('calls onRemove with the correct index when delete is clicked', () => {
    const exclusions: SurfaceExclusion[] = [
      { surface_target: 'wall', type: 'credence', area_m2: 2 },
      { surface_target: 'wall', type: 'baseboard', area_m2: 1 },
    ];
    render(
      <ExclusionsSection
        exclusions={exclusions}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
        netWallAreaCm2={450000}
      />,
    );
    const deleteButtons = screen.getAllByRole('button', { name: /supprimer/i });
    fireEvent.click(deleteButtons[1]);
    expect(mockRemove).toHaveBeenCalledWith(1);
  });

  it('shows a warning when the excluded area exceeds the net wall area', () => {
    const exclusions: SurfaceExclusion[] = [
      { surface_target: 'wall', type: 'credence', area_m2: 100 },
    ];
    render(
      <ExclusionsSection
        exclusions={exclusions}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
        netWallAreaCm2={450000}
      />,
    );
    expect(
      screen.getByText(/les dimensions semblent incoherentes/i),
    ).toBeInTheDocument();
  });

  it('does not show a warning when the excluded area is within bounds', () => {
    const exclusions: SurfaceExclusion[] = [
      { surface_target: 'wall', type: 'credence', area_m2: 2 },
    ];
    render(
      <ExclusionsSection
        exclusions={exclusions}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
        netWallAreaCm2={450000}
      />,
    );
    expect(
      screen.queryByText(/les dimensions semblent incoherentes/i),
    ).not.toBeInTheDocument();
  });

  it('shows empty state message when no exclusions', () => {
    render(
      <ExclusionsSection
        exclusions={[]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
        netWallAreaCm2={450000}
      />,
    );
    expect(screen.getByText(/aucune surface exclue/i)).toBeInTheDocument();
  });
});
