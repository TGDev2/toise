import {
  benchmarkShortfall,
  buildCostBenchmarks,
  compareToReference,
  DEFAULT_COST_BENCHMARK_OPTIONS,
  resolveSurfaceBand,
  rollUpComparisons,
  surfaceBandLabel,
  type BenchmarkComparison,
  type CostObservation,
} from './cost-benchmark';

function obs(overrides: Partial<CostObservation> = {}): CostObservation {
  return {
    work_type_code: 'painting',
    surface_m2: 20,
    cost_per_m2: 12,
    organization_id: 'org-1',
    observed_at: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  };
}

/** n observations, une organisation distincte chacune. */
function fromDistinctOrgs(costsPerM2: number[]): CostObservation[] {
  return costsPerM2.map((cost, i) =>
    obs({ cost_per_m2: cost, organization_id: `org-${i}` }),
  );
}

describe('resolveSurfaceBand', () => {
  it.each([
    [0.5, 'small'],
    [9.99, 'small'],
    [10, 'medium'],
    [29.99, 'medium'],
    [30, 'large'],
    [500, 'large'],
  ])('%s m² → %s', (surface, band) => {
    expect(resolveSurfaceBand(surface)).toBe(band);
  });

  it('donne un libellé à chaque bande', () => {
    for (const band of ['small', 'medium', 'large'] as const) {
      expect(surfaceBandLabel(band)).not.toBe('');
    }
  });
});

describe('buildCostBenchmarks — k-anonymat', () => {
  it('publie une cellule qui satisfait volume et anonymat', () => {
    const cells = buildCostBenchmarks(
      fromDistinctOrgs([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]),
    );

    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({
      work_type_code: 'painting',
      surface_band: 'medium',
      status: 'published',
      median_cost_per_m2: 14.5,
      sample_size: 10,
      organization_count: 10,
    });
  });

  it("ne publie pas de médiane sous le k d'organisations, même avec du volume", () => {
    // 20 observations, mais 4 organisations seulement : le volume est là,
    // l'anonymat non. C'est bien l'anonymat qui doit trancher.
    const observations = Array.from({ length: 20 }, (_, i) =>
      obs({ cost_per_m2: 10 + i, organization_id: `org-${i % 4}` }),
    );

    const [cell] = buildCostBenchmarks(observations);
    expect(cell.status).toBe('insufficient_anonymity');
    expect(cell.median_cost_per_m2).toBeNull();
    expect(cell.organization_count).toBe(4);
  });

  it('ne publie pas de médiane sous le seuil de volume, même bien réparti', () => {
    const [cell] = buildCostBenchmarks(fromDistinctOrgs([10, 12, 14, 16, 18]));

    expect(cell.status).toBe('insufficient_volume');
    expect(cell.median_cost_per_m2).toBeNull();
    expect(cell.organization_count).toBe(5);
  });

  it('plafonne la contribution d’une organisation à la cohorte', () => {
    // org-flood en apporte 8, écrêtées à 3 : elle ne peut ni constituer la
    // cohorte ni relire sa propre dépense dans la médiane.
    const observations = [
      ...Array.from({ length: 8 }, (_, i) =>
        obs({
          cost_per_m2: 100,
          organization_id: 'org-flood',
          observed_at: new Date(2026, 6, i + 1),
        }),
      ),
      ...fromDistinctOrgs([10, 11, 12, 13, 14, 15, 16]),
    ];

    const [cell] = buildCostBenchmarks(observations);
    expect(cell.sample_size).toBe(10);
    expect(cell.organization_count).toBe(8);
    expect(cell.status).toBe('published');
    // Sans plafonnement, la médiane de 15 valeurs dont 8 à 100 vaudrait 100.
    expect(cell.median_cost_per_m2).toBeLessThan(20);
  });

  it('conserve les observations les plus récentes lors du plafonnement', () => {
    const observations = [
      ...[1, 2, 3, 4, 5].map((day) =>
        obs({
          cost_per_m2: day <= 2 ? 1000 : 5,
          organization_id: 'org-capped',
          observed_at: new Date(2026, 6, day),
        }),
      ),
      ...fromDistinctOrgs([5, 5, 5, 5, 5, 5, 5]),
    ];

    const [cell] = buildCostBenchmarks(observations);
    // Les deux valeurs à 1000 sont les plus anciennes : écrêtées.
    expect(cell.median_cost_per_m2).toBe(5);
    expect(cell.sample_size).toBe(10);
  });

  it('sépare les bandes de surface plutôt que de les mélanger', () => {
    const cells = buildCostBenchmarks([
      ...fromDistinctOrgs(Array<number>(10).fill(40)).map((o) => ({
        ...o,
        surface_m2: 4,
      })),
      ...fromDistinctOrgs(Array<number>(10).fill(12)).map((o) => ({
        ...o,
        surface_m2: 50,
      })),
    ]);

    expect(cells).toHaveLength(2);
    const small = cells.find((c) => c.surface_band === 'small');
    const large = cells.find((c) => c.surface_band === 'large');
    expect(small?.median_cost_per_m2).toBe(40);
    expect(large?.median_cost_per_m2).toBe(12);
  });

  it('sépare les types d’ouvrage', () => {
    const cells = buildCostBenchmarks([
      ...fromDistinctOrgs(Array<number>(10).fill(12)),
      ...fromDistinctOrgs(Array<number>(10).fill(45)).map((o) => ({
        ...o,
        work_type_code: 'tiling',
      })),
    ]);

    expect(cells).toHaveLength(2);
    expect(
      cells.find((c) => c.work_type_code === 'tiling')?.median_cost_per_m2,
    ).toBe(45);
  });

  it('ignore les observations à surface ou coût non strictement positifs', () => {
    const cells = buildCostBenchmarks([
      ...fromDistinctOrgs([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]),
      obs({ surface_m2: 0, organization_id: 'org-zero' }),
      obs({ cost_per_m2: 0, organization_id: 'org-free' }),
      obs({ cost_per_m2: -5, organization_id: 'org-neg' }),
    ]);

    expect(cells).toHaveLength(1);
    expect(cells[0].sample_size).toBe(10);
  });

  it('ne retourne rien sans observation', () => {
    expect(buildCostBenchmarks([])).toEqual([]);
  });

  it('expose des seuils conformes à ceux écrits au plan', () => {
    expect(DEFAULT_COST_BENCHMARK_OPTIONS).toEqual({
      minObservations: 10,
      minOrganizations: 5,
      maxObservationsPerOrg: 3,
      neutralBandPercent: 3,
    });
  });
});

describe('compareToReference', () => {
  it('exprime un écart en pourcentage de la référence', () => {
    expect(compareToReference(80, 100)).toEqual({
      delta_percent: 20,
      position: 'below',
    });
  });

  it('signale un dépassement par un écart négatif', () => {
    expect(compareToReference(125, 100)).toEqual({
      delta_percent: -25,
      position: 'above',
    });
  });

  it('range un écart infime dans la bande neutre', () => {
    const { delta_percent, position } = compareToReference(99, 100);
    expect(delta_percent).toBe(1);
    expect(position).toBe('around');
  });

  it('sort de la bande neutre au seuil exact', () => {
    expect(compareToReference(97, 100).position).toBe('below');
  });
});

describe('rollUpComparisons', () => {
  function comparison(over: Partial<BenchmarkComparison>): BenchmarkComparison {
    return {
      work_type_code: 'painting',
      surface_band: 'medium',
      surface_m2: 20,
      cost: 200,
      cost_per_m2: 10,
      median_cost_per_m2: 10,
      delta_percent: 0,
      position: 'around',
      sample_size: 12,
      organization_count: 6,
      ...over,
    };
  }

  it('revalorise chaque ouvrage à sa médiane plutôt que de moyenner les pourcentages', () => {
    // 2 m² de peinture à +100 %, 40 m² de carrelage à −25 %. Moyenner les
    // pourcentages donnerait +37,5 % ; pondérer par la dépense donne −22,8 %.
    const overall = rollUpComparisons([
      comparison({ surface_m2: 2, cost: 40, median_cost_per_m2: 10 }),
      comparison({
        work_type_code: 'tiling',
        surface_band: 'large',
        surface_m2: 40,
        cost: 1200,
        median_cost_per_m2: 40,
      }),
    ]);

    expect(overall).toEqual({
      cost: 1240,
      reference_cost: 1620,
      delta_percent: 23.5,
      position: 'below',
    });
  });

  it('ne retourne rien sans ouvrage comparable', () => {
    expect(rollUpComparisons([])).toBeNull();
  });

  it('ne divise pas par une référence nulle', () => {
    expect(
      rollUpComparisons([comparison({ median_cost_per_m2: 0 })]),
    ).toBeNull();
  });
});

describe('benchmarkShortfall', () => {
  it('réclame les organisations du k-anonymat, plus exigeant que le volume', () => {
    // 10 observations à 3 par organisation n'en réclament que 4 ; le k en
    // réclame 5. C'est le plus exigeant des deux qui commande.
    expect(
      benchmarkShortfall({ sample_size: 10, organization_count: 4 }),
    ).toEqual({ missing_observations: 0, missing_organizations: 1 });
  });

  it("rapporte les deux manques d'une cohorte naissante", () => {
    expect(
      benchmarkShortfall({ sample_size: 3, organization_count: 2 }),
    ).toEqual({ missing_observations: 7, missing_organizations: 3 });
  });

  it('ne réclame plus rien à une cohorte publiable', () => {
    expect(
      benchmarkShortfall({ sample_size: 10, organization_count: 5 }),
    ).toEqual({ missing_observations: 0, missing_organizations: 0 });
  });
});
