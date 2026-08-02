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
        benchmarkFailed={false}
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
        benchmarkFailed={false}
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
        benchmarkFailed={false}
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
        benchmarkFailed={false}
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
        benchmarkFailed={false}
        benchmarkAllowed
        onShowPaywall={jest.fn()}
      />,
    );

    expect(screen.getByText(/Carrelage sol/)).toBeInTheDocument();
  });

  it('dit qu’il attend une cohorte, sans publier le moindre chiffre', () => {
    render(
      <CostBenchmarkPanel
        benchmark={makeBenchmark({
          available: false,
          overall: null,
          comparisons: [],
          work_types_without_reference: ['Carrelage sol'],
        })}
        benchmarkFailed={false}
        benchmarkAllowed
        onShowPaywall={jest.fn()}
      />,
    );

    expect(screen.getByText(/Pas encore de référence/i)).toBeInTheDocument();
    expect(screen.getByText(/Carrelage sol/)).toBeInTheDocument();
    // Le k-anonymat tient : l'attente s'annonce, aucune médiane ne fuit.
    expect(screen.queryByText(/EUR/)).not.toBeInTheDocument();
  });

  // Une panne réseau et une pénurie de cohorte produisaient le même écran vide.
  // L'une se répare en rechargeant, l'autre non : les confondre laisse
  // l'utilisateur sans le moindre geste utile.
  it('distingue une panne de chargement d’une cohorte insuffisante', () => {
    render(
      <CostBenchmarkPanel
        benchmark={null}
        benchmarkFailed
        benchmarkAllowed
        onShowPaywall={jest.fn()}
      />,
    );

    expect(screen.getByText(/Comparaison indisponible/i)).toBeInTheDocument();
    expect(screen.queryByText(/Pas encore de référence/i)).not.toBeInTheDocument();
  });

  it('ne montre pas la panne à qui n’a pas le palier', () => {
    render(
      <CostBenchmarkPanel
        benchmark={null}
        benchmarkFailed
        benchmarkAllowed={false}
        onShowPaywall={jest.fn()}
      />,
    );

    expect(screen.queryByText(/Comparaison indisponible/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Passer à Pro/i })).toBeInTheDocument();
  });

  it('n’affiche rien avant que la réponse soit chargée', () => {
    const { container } = render(
      <CostBenchmarkPanel
        benchmark={null}
        benchmarkFailed={false}
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
        benchmarkFailed={false}
        benchmarkAllowed={false}
        onShowPaywall={onShowPaywall}
      />,
    );

    expect(screen.queryByText(/15,00 EUR/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Passer à Pro/i }));
    expect(onShowPaywall).toHaveBeenCalled();
  });
});
