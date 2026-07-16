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
