import { render, screen, fireEvent } from '@testing-library/react';
import { CostBenchmarkPanel } from '../CostBenchmarkPanel';
import type {
  BenchmarkComparison,
  CostBenchmarkResponse,
} from '@/lib/cost-benchmark-types';

function makeComparison(
  overrides: Partial<BenchmarkComparison> = {},
): BenchmarkComparison {
  return {
    work_type_code: 'painting',
    work_type_label: 'Peinture murale',
    surface_band: 'medium',
    surface_band_label: 'de 10 à 30 m²',
    surface_m2: 20,
    cost: 240,
    cost_per_m2: 12,
    median_cost_per_m2: 15,
    delta_percent: 20,
    position: 'below',
    sample_size: 12,
    organization_count: 6,
    ...overrides,
  };
}

function makeBenchmark(
  overrides: Partial<CostBenchmarkResponse> = {},
): CostBenchmarkResponse {
  return {
    available: true,
    overall: {
      cost: 240,
      reference_cost: 300,
      delta_percent: 20,
      position: 'below',
    },
    comparisons: [makeComparison()],
    work_types_without_reference: [],
    computed_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('CostBenchmarkPanel', () => {
  it('annonce la promesse produit quand le chantier est sous la médiane', () => {
    render(
      <CostBenchmarkPanel
        benchmark={makeBenchmark()}
        benchmarkAllowed
        onShowPaywall={jest.fn()}
      />,
    );

    expect(
      screen.getByText(
        /coûte 20 % de moins que la médiane des projets similaires/i,
      ),
    ).toBeInTheDocument();
  });

  it('dit « de plus » sur un dépassement plutôt qu’un pourcentage négatif', () => {
    render(
      <CostBenchmarkPanel
        benchmark={makeBenchmark({
          overall: {
            cost: 375,
            reference_cost: 300,
            delta_percent: -25,
            position: 'above',
          },
        })}
        benchmarkAllowed
        onShowPaywall={jest.fn()}
      />,
    );

    expect(screen.getByText(/coûte 25 % de plus/i)).toBeInTheDocument();
    expect(screen.queryByText(/-25/)).not.toBeInTheDocument();
  });

  it('ne prétend pas à la précision dans la bande neutre', () => {
    render(
      <CostBenchmarkPanel
        benchmark={makeBenchmark({
          overall: {
            cost: 299,
            reference_cost: 300,
            delta_percent: 0.3,
            position: 'around',
          },
        })}
        benchmarkAllowed
        onShowPaywall={jest.fn()}
      />,
    );

    expect(
      screen.getByText(/est dans la médiane des projets similaires/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/0,3 %/)).not.toBeInTheDocument();
  });

  it('expose l’assise du chiffre : chantiers et entreprises', () => {
    render(
      <CostBenchmarkPanel
        benchmark={makeBenchmark()}
        benchmarkAllowed
        onShowPaywall={jest.fn()}
      />,
    );

    expect(
      screen.getByText(/12 chantiers de 6 entreprises/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/consommables exclus/i)).toBeInTheDocument();
  });

  it('nomme les ouvrages sans référence au lieu de les taire', () => {
    render(
      <CostBenchmarkPanel
        benchmark={makeBenchmark({
          work_types_without_reference: ['Carrelage sol'],
        })}
        benchmarkAllowed
        onShowPaywall={jest.fn()}
      />,
    );

    expect(screen.getByText(/Carrelage sol/)).toBeInTheDocument();
  });

  it('n’affiche rien tant qu’aucune cohorte n’est publiable', () => {
    const { container } = render(
      <CostBenchmarkPanel
        benchmark={makeBenchmark({
          available: false,
          overall: null,
          comparisons: [],
        })}
        benchmarkAllowed
        onShowPaywall={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('n’affiche rien avant que la réponse soit chargée', () => {
    const { container } = render(
      <CostBenchmarkPanel
        benchmark={null}
        benchmarkAllowed
        onShowPaywall={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('propose le paywall hors palier Pro, sans divulguer de médiane', () => {
    const onShowPaywall = jest.fn();
    render(
      <CostBenchmarkPanel
        benchmark={makeBenchmark()}
        benchmarkAllowed={false}
        onShowPaywall={onShowPaywall}
      />,
    );

    expect(screen.queryByText(/15,00 EUR/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Passer à Pro/i }));
    expect(onShowPaywall).toHaveBeenCalled();
  });
});
