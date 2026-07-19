import { render, screen } from '@testing-library/react';
import { RoomPreview } from '../RoomPreview';

describe('RoomPreview', () => {
  it('renders placeholder when dimensions are invalid', () => {
    render(<RoomPreview lengthCm={0} widthCm={0} unitSystem="metric" />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute(
      'aria-label',
      'Aperçu de la pièce (dimensions non définies)',
    );
  });

  it('renders room with metric labels', () => {
    render(<RoomPreview lengthCm={500} widthCm={400} unitSystem="metric" />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute(
      'aria-label',
      expect.stringContaining('5.00 m'),
    );
    expect(svg).toHaveAttribute(
      'aria-label',
      expect.stringContaining('4.00 m'),
    );
  });

  it('renders room with imperial labels', () => {
    render(<RoomPreview lengthCm={500} widthCm={400} unitSystem="imperial" />);
    const svg = screen.getByRole('img');
    expect(svg.getAttribute('aria-label')).toContain("'");
    expect(svg.getAttribute('aria-label')).toContain('"');
  });

  it('applies custom className', () => {
    const { container } = render(
      <RoomPreview lengthCm={500} widthCm={400} unitSystem="metric" className="w-full" />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('w-full');
  });

  it('renders a composite outline when multiple segments are provided', () => {
    render(
      <RoomPreview
        lengthCm={400}
        widthCm={300}
        unitSystem="metric"
        segments={[
          { x_cm: 0, y_cm: 0, length_cm: 400, width_cm: 300 },
          { x_cm: 400, y_cm: 0, length_cm: 200, width_cm: 150 },
        ]}
      />,
    );
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute(
      'aria-label',
      'Vue de dessus de la pièce (forme composée)',
    );
    // Un rectangle SVG par segment
    expect(svg.querySelectorAll('rect')).toHaveLength(2);
  });
});
