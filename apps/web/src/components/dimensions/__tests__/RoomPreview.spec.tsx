import { render, screen } from '@testing-library/react';
import { RoomPreview } from '../RoomPreview';

describe('RoomPreview', () => {
  it('renders placeholder when dimensions are invalid', () => {
    render(<RoomPreview lengthCm={0} widthCm={0} unitSystem="metric" />);
    const svg = screen.getByRole('img');
    expect(svg).toHaveAttribute(
      'aria-label',
      'Apercu de la piece (dimensions non definies)',
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
});
