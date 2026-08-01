import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { DecimalInput } from '../DecimalInput';

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DecimalInput
        aria-label="Longueur"
        value={value}
        onValueChange={setValue}
      />
      <output>{value}</output>
    </>
  );
}

describe('DecimalInput', () => {
  it('opens the decimal keypad without using type=number', () => {
    // `type="number"` rejette la virgule des claviers français ; c'est
    // précisément ce qu'on remplace, la régression serait silencieuse.
    render(<Harness />);

    const input = screen.getByLabelText('Longueur');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
  });

  it('accepts a comma and hands back a parseable value', () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('Longueur'), {
      target: { value: '4,25' },
    });

    expect(screen.getByRole('status')).toHaveTextContent('4.25');
  });

  it('ignores a keystroke that would produce an invalid number', () => {
    render(<Harness initial="4.2" />);

    fireEvent.change(screen.getByLabelText('Longueur'), {
      target: { value: '4.2x' },
    });

    expect(screen.getByRole('status')).toHaveTextContent('4.2');
  });

  it('allows clearing the field', () => {
    render(<Harness initial="4.2" />);

    fireEvent.change(screen.getByLabelText('Longueur'), {
      target: { value: '' },
    });

    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
