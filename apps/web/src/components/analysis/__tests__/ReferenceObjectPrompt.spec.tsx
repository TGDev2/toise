import { render, screen, fireEvent } from '@testing-library/react';
import { ReferenceObjectPrompt } from '../ReferenceObjectPrompt';

describe('ReferenceObjectPrompt', () => {
  const onRetry = jest.fn();
  const onRetryWithReference = jest.fn();
  const onManualFallback = jest.fn();

  const setup = () =>
    render(
      <ReferenceObjectPrompt
        onRetry={onRetry}
        onRetryWithReference={onRetryWithReference}
        onManualFallback={onManualFallback}
      />,
    );

  beforeEach(() => jest.clearAllMocks());

  it('offers both universal markers (A4 and bank card)', () => {
    setup();
    expect(
      screen.getByRole('button', { name: /Feuille A4/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Carte bancaire/i }),
    ).toBeInTheDocument();
  });

  it('keeps the étalon relaunch disabled until a marker is chosen', () => {
    setup();
    const relaunch = screen.getByRole('button', {
      name: /Relancer l'analyse avec cet étalon/i,
    });
    expect(relaunch).toBeDisabled();
  });

  it('relaunches analysis with the selected marker type', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Feuille A4/i }));
    fireEvent.click(
      screen.getByRole('button', {
        name: /Relancer l'analyse avec cet étalon/i,
      }),
    );
    expect(onRetryWithReference).toHaveBeenCalledWith('a4');
  });

  it('shows pose guidance for the chosen marker', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Carte bancaire/i }));
    expect(screen.getByText(/bien à plat contre un mur/i)).toBeInTheDocument();
  });

  it('still supports the door retry and manual fallback paths', () => {
    setup();
    fireEvent.click(
      screen.getByRole('button', { name: /Relancer avec une porte/i }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /saisie manuelle/i }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onManualFallback).toHaveBeenCalledTimes(1);
  });
});
