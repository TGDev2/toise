import { render, screen } from '@testing-library/react';
import { FlowProgress } from '../FlowProgress';

describe('FlowProgress', () => {
  it('states where the user is in the tunnel', () => {
    render(<FlowProgress step="work" projectId="p1" />);

    expect(screen.getByText('Étape 3 / 6 · Travaux')).toBeInTheDocument();
  });

  it('exposes progress to assistive technology', () => {
    render(<FlowProgress step="estimate" projectId="p1" />);

    const bar = screen.getByRole('progressbar', {
      name: 'Progression du devis',
    });
    expect(bar).toHaveAttribute('aria-valuenow', '4');
    expect(bar).toHaveAttribute('aria-valuemax', '6');
  });

  it('defaults the back link to the previous step of the tunnel', () => {
    render(<FlowProgress step="prices" projectId="p1" />);

    expect(
      screen.getByRole('link', { name: "Retour à l'étape Estimation" }),
    ).toHaveAttribute('href', '/projects/p1/estimate');
  });

  it('falls back to the dashboard on the first step', () => {
    render(<FlowProgress step="photos" projectId="p1" />);

    expect(
      screen.getByRole('link', { name: 'Retour au tableau de bord' }),
    ).toHaveAttribute('href', '/dashboard');
  });

  it('lets the caller override the back link (rooms carry a query param)', () => {
    render(
      <FlowProgress
        step="work"
        projectId="p1"
        backHref="/projects/p1/dimensions?room=r2"
      />,
    );

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/projects/p1/dimensions?room=r2',
    );
  });

  it('shows the project name when given one', () => {
    render(
      <FlowProgress step="photos" projectId="p1" projectName="Salle de bain" />,
    );

    expect(screen.getByText('Salle de bain')).toBeInTheDocument();
  });
});
