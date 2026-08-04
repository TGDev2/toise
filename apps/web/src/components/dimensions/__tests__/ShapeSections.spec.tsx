import { render, screen, fireEvent } from '@testing-library/react';
import { ShapeSections } from '../ShapeSections';
import type { ShapeSection } from '@/lib/surface';

describe('ShapeSections', () => {
  const mockAdd = jest.fn();
  const mockUpdate = jest.fn();
  const mockRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks an explicit yes/no question when there is no décroché yet', () => {
    render(
      <ShapeSections
        sections={[]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    expect(
      screen.getByText(/votre pièce a-t-elle un décroché ?/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /oui, ajouter un décroché/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /non, c'est un rectangle simple/i }),
    ).toBeInTheDocument();
  });

  it('adds the first section when answering "oui"', () => {
    render(
      <ShapeSections
        sections={[]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /décroché/i }));
    expect(mockAdd).toHaveBeenCalledWith({
      side: 'right',
      offset_cm: 0,
      along_cm: 100,
      depth_cm: 100,
    });
  });

  it('shows a dismissed state and a way back after answering "non"', () => {
    render(
      <ShapeSections
        sections={[]}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /non, c'est un rectangle simple/i }),
    );
    expect(screen.getByText(/pièce simple \(rectangle\)/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /oui, ajouter un décroché/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /\+ ajouter un décroché/i }));
    expect(
      screen.getByRole('button', { name: /oui, ajouter un décroché/i }),
    ).toBeInTheDocument();
  });

  it('offers a second décroché once the first is added', () => {
    const sections: ShapeSection[] = [
      { side: 'right', offset_cm: 0, along_cm: 100, depth_cm: 100 },
    ];
    render(
      <ShapeSections
        sections={sections}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    expect(screen.getByText(/ajouter un second décroché ?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /oui, ajouter/i }));
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it('offers a third décroché once the second is added', () => {
    const sections: ShapeSection[] = [
      { side: 'right', offset_cm: 0, along_cm: 100, depth_cm: 100 },
      { side: 'left', offset_cm: 0, along_cm: 100, depth_cm: 100 },
    ];
    render(
      <ShapeSections
        sections={sections}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    expect(screen.getByText(/ajouter un troisième décroché ?/i)).toBeInTheDocument();
  });

  it('stops guiding and falls back to a discreet link after a third décroché', () => {
    const sections: ShapeSection[] = [
      { side: 'right', offset_cm: 0, along_cm: 100, depth_cm: 100 },
      { side: 'left', offset_cm: 0, along_cm: 100, depth_cm: 100 },
      { side: 'top', offset_cm: 0, along_cm: 100, depth_cm: 100 },
    ];
    render(
      <ShapeSections
        sections={sections}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    expect(
      screen.queryByText(/ajouter un (second|troisième) décroché/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /\+ ajouter un autre décroché/i }),
    ).toBeInTheDocument();
  });

  it('stops guiding after declining a relance, but keeps the fallback link', () => {
    const sections: ShapeSection[] = [
      { side: 'right', offset_cm: 0, along_cm: 100, depth_cm: 100 },
    ];
    render(
      <ShapeSections
        sections={sections}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /non, c'est tout/i }));
    expect(
      screen.queryByText(/ajouter un (second|troisième) décroché/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /\+ ajouter un autre décroché/i }),
    ).toBeInTheDocument();
  });

  it('still renders one editable row per section with working update/remove', () => {
    const sections: ShapeSection[] = [
      { side: 'right', offset_cm: 0, along_cm: 150, depth_cm: 200 },
    ];
    render(
      <ShapeSections
        sections={sections}
        onAdd={mockAdd}
        onUpdate={mockUpdate}
        onRemove={mockRemove}
      />,
    );
    fireEvent.change(screen.getByLabelText(/depuis le coin/i), {
      target: { value: '10' },
    });
    expect(mockUpdate).toHaveBeenCalledWith(0, {
      side: 'right',
      offset_cm: 10,
      along_cm: 150,
      depth_cm: 200,
    });

    fireEvent.click(screen.getByRole('button', { name: /supprimer décroché 1/i }));
    expect(mockRemove).toHaveBeenCalledWith(0);
  });
});
