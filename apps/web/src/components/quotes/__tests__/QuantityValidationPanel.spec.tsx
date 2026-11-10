import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuantityValidationPanel } from '../QuantityValidationPanel';
import type { QuantityValidationState } from '@/lib/quantity-validation-types';

function makeState(
  overrides: Partial<QuantityValidationState> = {},
): QuantityValidationState {
  return {
    fingerprint: 'a'.repeat(64),
    lines: [
      {
        material_id: 'mat-paint',
        material_name: 'Peinture acrylique mate',
        work_type_code: 'wall_painting',
        work_type_label: 'Peinture murale',
        packaging_label: 'Pot 10 L',
        units_needed: 2,
      },
      {
        material_id: 'mat-adhesive',
        material_name: 'Mortier-colle C2',
        work_type_code: 'floor_tiling',
        work_type_label: 'Carrelage sol',
        packaging_label: 'Sac 25 kg',
        units_needed: 4,
      },
    ],
    validated_at: null,
    validated_by: null,
    ...overrides,
  };
}

describe('QuantityValidationPanel', () => {
  /**
   * La contrainte produit d'E2-4 : la validation en bloc coûte UN tap, quel que
   * soit le nombre de lignes. Une case par ligne aurait fait payer à chaque
   * chantier la vigilance de quelques-uns.
   */
  it('valide toutes les lignes en un seul geste', async () => {
    const onValidate = jest.fn().mockResolvedValue(undefined);
    render(
      <QuantityValidationPanel
        state={makeState()}
        onCorrect={jest.fn()}
        onValidate={onValidate}
        busy={false}
      />,
    );

    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Je valide ces quantités' }));

    await waitFor(() => expect(onValidate).toHaveBeenCalledTimes(1));
  });

  it('montre matériau, ouvrage et conditionnement de chaque ligne', () => {
    render(
      <QuantityValidationPanel
        state={makeState()}
        onCorrect={jest.fn()}
        onValidate={jest.fn()}
        busy={false}
      />,
    );

    expect(screen.getByText('Peinture acrylique mate')).toBeInTheDocument();
    expect(
      screen.getByText('Peinture murale · Pot 10 L'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Quantité pour Mortier-colle C2'),
    ).toHaveValue(4);
  });

  it('remonte une correction de ligne à la sortie du champ', async () => {
    const onCorrect = jest.fn().mockResolvedValue(undefined);
    render(
      <QuantityValidationPanel
        state={makeState()}
        onCorrect={onCorrect}
        onValidate={jest.fn()}
        busy={false}
      />,
    );

    const input = screen.getByLabelText('Quantité pour Mortier-colle C2');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(onCorrect).toHaveBeenCalledWith('mat-adhesive', 5),
    );
  });

  /**
   * Le champ est aussi celui qu'on quitte sans rien changer, à chaque relecture.
   * Sans cette garde, relire les quantités écrirait des corrections nulles dans
   * la trace destinée à E8.
   */
  it("n'écrit rien quand le champ est quitté sans changement", () => {
    const onCorrect = jest.fn();
    render(
      <QuantityValidationPanel
        state={makeState()}
        onCorrect={onCorrect}
        onValidate={jest.fn()}
        busy={false}
      />,
    );

    fireEvent.blur(screen.getByLabelText('Quantité pour Mortier-colle C2'));

    expect(onCorrect).not.toHaveBeenCalled();
  });

  it('refuse une saisie vide ou négative et rétablit la valeur affichée', () => {
    const onCorrect = jest.fn();
    render(
      <QuantityValidationPanel
        state={makeState()}
        onCorrect={onCorrect}
        onValidate={jest.fn()}
        busy={false}
      />,
    );

    const input = screen.getByLabelText('Quantité pour Mortier-colle C2');
    fireEvent.change(input, { target: { value: '-3' } });
    fireEvent.blur(input);

    expect(onCorrect).not.toHaveBeenCalled();
    expect(input).toHaveValue(4);
  });

  it('remplace le geste par sa trace une fois les quantités validées', () => {
    render(
      <QuantityValidationPanel
        state={makeState({
          validated_at: '2026-08-08T12:00:00.000Z',
          validated_by: 'artisan@toise.test',
        })}
        onCorrect={jest.fn()}
        onValidate={jest.fn()}
        busy={false}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Je valide ces quantités' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Quantités validées le .* par artisan@toise\.test/),
    ).toBeInTheDocument();
  });

  /**
   * La prop fait autorité : après un `PATCH`, la valeur retenue peut différer
   * de ce qui a été tapé. Un champ qui garde son brouillon afficherait
   * indéfiniment une quantité que la base ne porte pas (leçon 24).
   */
  it('se resynchronise sur la quantité que le serveur a retenue', () => {
    const { rerender } = render(
      <QuantityValidationPanel
        state={makeState()}
        onCorrect={jest.fn()}
        onValidate={jest.fn()}
        busy={false}
      />,
    );

    const input = screen.getByLabelText('Quantité pour Mortier-colle C2');
    fireEvent.change(input, { target: { value: '99' } });

    const next = makeState();
    next.lines[1] = { ...next.lines[1], units_needed: 7 };
    rerender(
      <QuantityValidationPanel
        state={next}
        onCorrect={jest.fn()}
        onValidate={jest.fn()}
        busy={false}
      />,
    );

    expect(screen.getByLabelText('Quantité pour Mortier-colle C2')).toHaveValue(
      7,
    );
  });

  it('ne demande rien quand aucune ligne ne partira sur le devis', () => {
    const { container } = render(
      <QuantityValidationPanel
        state={makeState({ lines: [] })}
        onCorrect={jest.fn()}
        onValidate={jest.fn()}
        busy={false}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
