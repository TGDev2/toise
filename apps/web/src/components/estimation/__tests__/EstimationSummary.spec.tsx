import { render, screen } from '@testing-library/react';
import { EstimationSummary } from '../EstimationSummary';
import { makeLineItem, makeFloorTilingItem, makeMultiWorkTypeItems } from './fixtures';

describe('EstimationSummary', () => {
  it('should not render when only one work type', () => {
    const items = [
      makeLineItem({ material_id: 'a' }),
      makeLineItem({ material_id: 'b', material_name: 'Sous-couche' }),
    ];
    const { container } = render(<EstimationSummary items={items} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render when 2+ work types are present', () => {
    render(<EstimationSummary items={makeMultiWorkTypeItems()} />);
    expect(screen.getByText('Recapitulatif global')).toBeInTheDocument();
  });

  it('should consolidate same material from different work types', () => {
    const items = [
      makeLineItem({
        material_id: 'shared',
        material_name: 'Joint',
        packaging_label: 'Sac 5 kg',
        units_needed: 2,
      }),
      makeFloorTilingItem({
        material_id: 'shared',
        material_name: 'Joint',
        packaging_label: 'Sac 5 kg',
        units_needed: 3,
      }),
    ];
    render(<EstimationSummary items={items} />);

    // Should show consolidated: 2 + 3 = 5
    expect(screen.getByText('5 × Sac 5 kg')).toBeInTheDocument();
    // Only one entry for "Joint"
    const joints = screen.getAllByText('Joint');
    expect(joints).toHaveLength(1);
  });

  // E1-5 : la consolidation se fait par format, pas par libellé d'achat. Deux
  // lignes panachées identiques cumulées telles quelles donneraient
  // « 4 × Pot 5 L + Pot 2.5 L », qui ne veut rien dire.
  it('consolide un achat panaché format par format', () => {
    const mixed = {
      packaging_label: 'Pot 5 L + Pot 2.5 L',
      packaging_qty_per_unit: 3.75,
      units_needed: 2,
      packaging_breakdown: [
        { label: 'Pot 5 L', units: 1 },
        { label: 'Pot 2.5 L', units: 1 },
      ],
    };
    const items = [
      makeLineItem({ material_id: 'shared', material_name: 'Peinture', ...mixed }),
      makeFloorTilingItem({
        material_id: 'shared',
        material_name: 'Peinture',
        ...mixed,
      }),
    ];
    render(<EstimationSummary items={items} />);

    expect(screen.getByText('2 × Pot 5 L')).toBeInTheDocument();
    expect(screen.getByText('2 × Pot 2.5 L')).toBeInTheDocument();
  });

  it('should list different materials separately', () => {
    render(<EstimationSummary items={makeMultiWorkTypeItems()} />);

    expect(screen.getByText('Peinture acrylique mate')).toBeInTheDocument();
    expect(screen.getByText('Carrelage grès cérame 30x30')).toBeInTheDocument();
  });

  it('should show correct material count badge', () => {
    render(<EstimationSummary items={makeMultiWorkTypeItems()} />);
    expect(screen.getByText('2 matériaux')).toBeInTheDocument();
  });
});
