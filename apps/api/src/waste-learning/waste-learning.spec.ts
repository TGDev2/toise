import {
  DEFAULT_WASTE_LEARNING_OPTIONS,
  impliedWastePercent,
  learnWasteFactors,
  median,
  medianAbsoluteDeviation,
  organizationObservationCap,
  overlayLearnedWasteFactors,
  WasteObservation,
} from './waste-learning';

const BASELINE = 10;
const baselineResolver = () => BASELINE;

function makeObservation(
  overrides: Partial<WasteObservation> = {},
): WasteObservation {
  return {
    material_id: 'mat-tile',
    pose_type: 'diagonal',
    skill_level: 'intermediate',
    applied_percent: BASELINE,
    estimated_units: 10,
    actual_units: 10,
    organization_id: 'org-1',
    observed_at: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  };
}

/** n observations identiques, réparties sur autant d'organisations distinctes. */
function spread(
  count: number,
  overrides: Partial<WasteObservation> = {},
): WasteObservation[] {
  return Array.from({ length: count }, (_, i) =>
    makeObservation({ organization_id: `org-${i}`, ...overrides }),
  );
}

describe('median / medianAbsoluteDeviation', () => {
  it('takes the middle value on an odd sample', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('averages the two middle values on an even sample', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('ignores an extreme outlier where a mean would not', () => {
    expect(median([10, 11, 12, 13, 1000])).toBe(12);
  });

  it('measures dispersion around the centre', () => {
    expect(medianAbsoluteDeviation([10, 12, 14], 12)).toBe(2);
  });
});

describe('impliedWastePercent', () => {
  it('returns the applied factor when the purchase matches the estimate', () => {
    // Propriété centrale : ne rien ajuster est un point fixe.
    expect(
      impliedWastePercent(
        makeObservation({
          applied_percent: 7,
          estimated_units: 12,
          actual_units: 12,
        }),
      ),
    ).toBeCloseTo(7);
  });

  it('rises when more was bought than estimated', () => {
    // 10 % appliqué, 20 % de conditionnements en plus → 1,10 × 1,2 − 1 = 32 %.
    expect(
      impliedWastePercent(
        makeObservation({ estimated_units: 10, actual_units: 12 }),
      ),
    ).toBeCloseTo(32);
  });

  it('falls when less was bought than estimated', () => {
    expect(
      impliedWastePercent(
        makeObservation({ estimated_units: 10, actual_units: 9 }),
      ),
    ).toBeCloseTo(-1);
  });
});

describe('learnWasteFactors — garde-fous', () => {
  it('learns nothing below the minimum volume', () => {
    const observations = spread(
      DEFAULT_WASTE_LEARNING_OPTIONS.minObservations - 1,
      { actual_units: 12 },
    );

    const [outcome] = learnWasteFactors(observations, baselineResolver);

    expect(outcome.status).toBe('insufficient_volume');
    expect(outcome.factor_percent).toBeNull();
  });

  // Le cas déterminant : une organisation majoritaire dans une cellule choisit la
  // médiane, et son unanimité rend le MAD nul — le test de dispersion, seul autre
  // garde-fou, ne peut donc pas la rattraper.
  it('refuses to let one organisation hold the majority of a cell', () => {
    const observations = [
      // 5 chantiers d'une même organisation déclarant une consommation extrême.
      ...Array.from({ length: 5 }, (_, i) =>
        makeObservation({
          organization_id: 'org-dominante',
          estimated_units: 10,
          actual_units: 30, // perte impliquée : 1,10 × 3 − 1 = 230 %
          observed_at: new Date(2026, 0, i + 1),
        }),
      ),
      // 3 observations honnêtes d'organisations distinctes : achat = estimation.
      ...spread(3, { estimated_units: 10, actual_units: 10 }),
    ];

    const [outcome] = learnWasteFactors(observations, baselineResolver);

    expect(outcome.status).toBe('insufficient_volume');
    expect(outcome.factor_percent).toBeNull();
  });

  it('keeps the median inside the honest range when one organisation is loud', () => {
    const observations = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeObservation({
          organization_id: 'org-dominante',
          estimated_units: 10,
          actual_units: 30,
          observed_at: new Date(2026, 0, i + 1),
        }),
      ),
      ...spread(5, { estimated_units: 10, actual_units: 10 }),
    ];

    const [outcome] = learnWasteFactors(observations, baselineResolver);

    // 3 retenus pour l'organisation bruyante contre 5 honnêtes : la médiane des 8
    // tombe entre deux observations honnêtes, donc sur la valeur catalogue.
    expect(outcome.observed_percent).toBeCloseTo(BASELINE);
    expect(outcome.status).toBe('no_change');
  });

  it('caps how much a single organisation weighs in a cell', () => {
    // 20 chantiers d'une seule organisation → 3 retenus, sous le minimum de 8.
    const observations = Array.from({ length: 20 }, (_, i) =>
      makeObservation({
        organization_id: 'org-dominante',
        actual_units: 14,
        observed_at: new Date(2026, 0, i + 1),
      }),
    );

    const [outcome] = learnWasteFactors(observations, baselineResolver);

    expect(outcome.sample_size).toBe(
      organizationObservationCap(DEFAULT_WASTE_LEARNING_OPTIONS),
    );
    expect(outcome.status).toBe('insufficient_volume');
  });

  it('never lets one organisation reach half of the minimum sample', () => {
    // L'invariant qui porte le garde-fou, énoncé sur les options elles-mêmes :
    // le régler par deux constantes indépendantes est ce qui avait ouvert le trou.
    expect(
      organizationObservationCap(DEFAULT_WASTE_LEARNING_OPTIONS),
    ).toBeLessThan(DEFAULT_WASTE_LEARNING_OPTIONS.minObservations / 2);

    // Y compris si quelqu'un desserre le minimum sans toucher au reste.
    for (const minObservations of [1, 2, 3, 5, 8, 9, 20, 41]) {
      const options = { ...DEFAULT_WASTE_LEARNING_OPTIONS, minObservations };
      expect(organizationObservationCap(options)).toBeLessThan(
        minObservations / 2,
      );
    }
  });

  it('keeps the most recent observations when capping', () => {
    const observations = [
      ...Array.from({ length: 6 }, (_, i) =>
        makeObservation({
          organization_id: 'org-1',
          actual_units: 20,
          observed_at: new Date(2026, 0, i + 1),
        }),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        makeObservation({
          organization_id: 'org-1',
          actual_units: 11,
          observed_at: new Date(2026, 6, i + 1),
        }),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        makeObservation({
          organization_id: `org-autre-${i}`,
          actual_units: 11,
        }),
      ),
    ];

    const [outcome] = learnWasteFactors(observations, baselineResolver);

    // Les 3 achats récents (11) d'`org-1` sont conservés, les anciens (20)
    // écartés : la médiane vaut 21 % et non une valeur tirée vers le haut.
    expect(outcome.sample_size).toBe(
      organizationObservationCap(DEFAULT_WASTE_LEARNING_OPTIONS) + 6,
    );
    expect(outcome.observed_percent).toBeCloseTo(21);
  });

  it('does not move when everyone buys exactly what was estimated', () => {
    const [outcome] = learnWasteFactors(spread(20), baselineResolver);

    expect(outcome.observed_percent).toBeCloseTo(BASELINE);
    expect(outcome.status).toBe('no_change');
  });

  it('rejects a cell whose observations disagree too much', () => {
    const observations = [
      ...spread(6, { actual_units: 20 }).map((o, i) => ({
        ...o,
        organization_id: `org-haut-${i}`,
      })),
      ...spread(6, { actual_units: 5 }).map((o, i) => ({
        ...o,
        organization_id: `org-bas-${i}`,
      })),
    ];

    const [outcome] = learnWasteFactors(observations, baselineResolver);

    expect(outcome.status).toBe('too_dispersed');
    expect(outcome.factor_percent).toBeNull();
  });

  it('shrinks toward the catalog value instead of jumping to the median', () => {
    // 10 observations à +10 % d'achats → perte impliquée 21 %.
    const observations = spread(10, { estimated_units: 10, actual_units: 11 });

    const [outcome] = learnWasteFactors(observations, baselineResolver);

    expect(outcome.status).toBe('learned');
    expect(outcome.observed_percent).toBeCloseTo(21);
    // Crédibilité 10 / (10 + 12) = 0,4545 → 10 + 0,4545 × 11 = 15,0 %.
    expect(outcome.factor_percent).toBeCloseTo(15, 1);
    expect(outcome.factor_percent!).toBeLessThan(outcome.observed_percent!);
  });

  it('converges as the sample grows', () => {
    const small = learnWasteFactors(
      spread(10, { actual_units: 11 }),
      baselineResolver,
    )[0];
    const large = learnWasteFactors(
      spread(60, { actual_units: 11 }),
      baselineResolver,
    )[0];

    expect(large.factor_percent!).toBeGreaterThan(small.factor_percent!);
    expect(large.factor_percent!).toBeLessThan(large.observed_percent!);
  });

  it('never moves further than the maximum deviation from the catalog', () => {
    // Achats systématiquement doublés : médiane à 120 %, écrêtée à base + 10.
    const observations = spread(60, { estimated_units: 10, actual_units: 20 });

    const [outcome] = learnWasteFactors(observations, baselineResolver);

    expect(outcome.observed_percent).toBeCloseTo(120);
    expect(outcome.factor_percent).toBe(
      BASELINE + DEFAULT_WASTE_LEARNING_OPTIONS.maxDeviationPoints,
    );
  });

  it('never falls below the absolute floor', () => {
    const observations = spread(60, { estimated_units: 20, actual_units: 3 });

    const [outcome] = learnWasteFactors(
      observations,
      () => 4,
      // Écart maximal desserré pour prouver que le plancher absolu tient seul.
      {
        ...DEFAULT_WASTE_LEARNING_OPTIONS,
        maxDeviationPoints: 100,
        maxMadPoints: 100,
      },
    );

    expect(outcome.factor_percent).toBe(
      DEFAULT_WASTE_LEARNING_OPTIONS.minFactorPercent,
    );
  });

  it('writes nothing when the adjustment is pure noise', () => {
    // 60 observations dont une seule dévie → médiane = base, écart < 0,5 point.
    const observations = [
      ...spread(59),
      makeObservation({ organization_id: 'org-99', actual_units: 11 }),
    ];

    const [outcome] = learnWasteFactors(observations, baselineResolver);

    expect(outcome.status).toBe('no_change');
  });

  it('splits observations by material, pose and skill level', () => {
    const observations = [
      ...spread(10, { pose_type: 'diagonal', actual_units: 12 }),
      ...spread(10, { pose_type: 'standard', actual_units: 10 }),
      ...spread(10, { skill_level: 'beginner', actual_units: 13 }),
      ...spread(10, { material_id: 'mat-paint', actual_units: 10 }),
    ];

    const outcomes = learnWasteFactors(observations, baselineResolver);

    expect(outcomes).toHaveLength(4);
    const diagonal = outcomes.find(
      (o) =>
        o.pose_type === 'diagonal' &&
        o.skill_level === 'intermediate' &&
        o.material_id === 'mat-tile',
    );
    const beginner = outcomes.find((o) => o.skill_level === 'beginner');
    expect(diagonal!.observed_percent).toBeCloseTo(32);
    expect(beginner!.observed_percent).toBeCloseTo(43);
  });

  it('interprets each observation against the factor applied at the time', () => {
    // Même achat réel, mais deux facteurs appliqués différents : sans le
    // `applied_percent` figé sur la ligne, l'estimateur dériverait à chaque
    // ré-apprentissage au lieu de converger.
    const before = learnWasteFactors(
      spread(30, { applied_percent: 10, actual_units: 11 }),
      baselineResolver,
    )[0];
    const after = learnWasteFactors(
      spread(30, { applied_percent: 15, actual_units: 11 }),
      baselineResolver,
    )[0];

    expect(before.observed_percent).toBeCloseTo(21);
    expect(after.observed_percent).toBeCloseTo(26.5);
  });

  it('resolves the baseline per cell', () => {
    const observations = [
      ...spread(10, { pose_type: 'diagonal', actual_units: 11 }),
      ...spread(10, { pose_type: 'standard', actual_units: 11 }),
    ];

    const outcomes = learnWasteFactors(observations, (cell) =>
      cell.pose_type === 'diagonal' ? 15 : 5,
    );

    expect(
      outcomes.find((o) => o.pose_type === 'diagonal')!.baseline_percent,
    ).toBe(15);
    expect(
      outcomes.find((o) => o.pose_type === 'standard')!.baseline_percent,
    ).toBe(5);
  });
});

describe('overlayLearnedWasteFactors', () => {
  const catalog = [
    { pose_type: 'standard', skill_level: 'intermediate', factor_percent: 5 },
    { pose_type: 'diagonal', skill_level: 'intermediate', factor_percent: 12 },
  ];

  it('returns the catalog untouched when nothing has been learned', () => {
    expect(overlayLearnedWasteFactors(catalog, [])).toBe(catalog);
  });

  it('replaces the matching cell and marks its source', () => {
    const merged = overlayLearnedWasteFactors(catalog, [
      {
        pose_type: 'diagonal',
        skill_level: 'intermediate',
        factor_percent: 14,
      },
    ]);

    expect(merged).toHaveLength(2);
    expect(merged.find((wf) => wf.pose_type === 'diagonal')).toEqual({
      pose_type: 'diagonal',
      skill_level: 'intermediate',
      factor_percent: 14,
      source: 'learned',
    });
    // Le catalogue d'origine n'est pas muté.
    expect(catalog[1].factor_percent).toBe(12);
  });

  it('adds a cell the catalog did not carry', () => {
    const merged = overlayLearnedWasteFactors(catalog, [
      { pose_type: 'diagonal', skill_level: 'beginner', factor_percent: 18 },
    ]);

    expect(merged).toHaveLength(3);
    expect(merged[2].skill_level).toBe('beginner');
  });

  it('coerces the numeric column coming back as a string', () => {
    const merged = overlayLearnedWasteFactors(catalog, [
      {
        pose_type: 'standard',
        skill_level: 'intermediate',
        factor_percent: '7.50' as unknown as number,
      },
    ]);

    expect(merged[0].factor_percent).toBe(7.5);
  });
});
