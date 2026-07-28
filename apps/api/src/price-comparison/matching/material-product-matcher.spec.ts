import {
  MaterialProductMatcher,
  type FeedProduct,
  type MatchTarget,
} from './material-product-matcher';

const TARGETS: MatchTarget[] = [
  {
    material_id: 'mat-paint-mate',
    name: 'Peinture acrylique mate',
    category: 'painting',
    unit: 'L',
  },
  {
    material_id: 'mat-paint-satin',
    name: 'Peinture acrylique satinée',
    category: 'painting',
    unit: 'L',
  },
  {
    material_id: 'mat-mortier-c2',
    name: 'Mortier-colle flexible (C2)',
    category: 'tiling',
    unit: 'kg',
  },
  {
    material_id: 'mat-carrelage-30',
    name: 'Carrelage extérieur antidérapant 30x30 cm',
    category: 'tiling',
    unit: 'm2',
  },
  {
    material_id: 'mat-lambris',
    name: 'Lambris PVC couleur 2.6m',
    category: 'wall_covering',
    unit: 'm',
  },
];

function product(overrides: Partial<FeedProduct> = {}): FeedProduct {
  return {
    external_id: 'P1',
    title: 'Produit',
    brand: null,
    category_path: 'Bricolage',
    price: 10,
    currency: 'EUR',
    product_url: 'https://example.fr/p1',
    availability: 'in_stock',
    ...overrides,
  };
}

function matchFor(
  products: FeedProduct[],
  materialId: string,
  targets: MatchTarget[] = TARGETS,
) {
  const matcher = new MaterialProductMatcher(targets);
  for (const p of products) {
    matcher.consider(p);
  }
  return matcher.results().find((r) => r.material_id === materialId);
}

describe('MaterialProductMatcher', () => {
  it('matches a product whose title covers the material name', () => {
    const result = matchFor(
      [
        product({
          external_id: 'MM-1',
          title: 'Peinture acrylique satinée blanche 2,5 L',
          category_path: 'Peinture > Peinture murale',
          price: 34.9,
        }),
      ],
      'mat-paint-satin',
    );

    expect(result).toBeDefined();
    expect(result!.product.external_id).toBe('MM-1');
    expect(result!.pack).toEqual({ qty: 2.5, unit: 'L' });
    expect(result!.score).toBeGreaterThanOrEqual(0.55);
  });

  it('does not leak a satin paint onto the mate material (discriminant lock)', () => {
    const matcher = new MaterialProductMatcher(TARGETS);
    matcher.consider(
      product({
        title: 'Peinture acrylique satinée blanche 2,5 L',
        category_path: 'Peinture',
      }),
    );

    const ids = matcher.results().map((r) => r.material_id);
    expect(ids).toContain('mat-paint-satin');
    expect(ids).not.toContain('mat-paint-mate');
  });

  it('gives the product to the material that fits it best, not to a superset name', () => {
    // « Peinture acrylique mate blanche » satisfait entièrement le matériau
    // « mate » et aux deux tiers le matériau « extra-mate » : seul le premier
    // doit le revendiquer.
    const targets: MatchTarget[] = [
      {
        material_id: 'mat-mate',
        name: 'Peinture acrylique mate',
        category: 'painting',
        unit: 'L',
      },
      {
        material_id: 'mat-extra-mate',
        name: 'Peinture acrylique extra-mate',
        category: 'painting',
        unit: 'L',
      },
    ];
    const matcher = new MaterialProductMatcher(targets);
    matcher.consider(
      product({
        title: 'Peinture acrylique mate blanche 2,5 L',
        category_path: 'Peinture',
      }),
    );

    expect(matcher.results().map((r) => r.material_id)).toEqual(['mat-mate']);
  });

  it('refuses a product whose wording belongs to a neighbouring material', () => {
    // Le catalogue n'a pas de « velours » en glycéro : aucun matériau ne doit
    // récupérer ce produit par défaut.
    const targets: MatchTarget[] = [
      {
        material_id: 'mat-glycero-mate',
        name: 'Peinture glycéro mate',
        category: 'painting',
        unit: 'L',
      },
      {
        material_id: 'mat-glycero-satin',
        name: 'Peinture glycéro satinée',
        category: 'painting',
        unit: 'L',
      },
      {
        material_id: 'mat-acrylique-velours',
        name: 'Peinture acrylique velours',
        category: 'painting',
        unit: 'L',
      },
    ];
    const matcher = new MaterialProductMatcher(targets);
    matcher.consider(
      product({
        title: 'Peinture glycéro velours blanc 2,5 L',
        category_path: 'Peinture',
      }),
    );

    expect(matcher.results()).toHaveLength(0);
  });

  it('refuses a C1 mortar for a C2 material (spec-token lock)', () => {
    expect(
      matchFor(
        [
          product({
            title: 'Mortier-colle flexible C1 25 kg',
            category_path: 'Carrelage > Mortier-colle',
          }),
        ],
        'mat-mortier-c2',
      ),
    ).toBeUndefined();
  });

  it('accepts a C2S1 mortar for a C2 material', () => {
    const result = matchFor(
      [
        product({
          title: 'Mortier-colle flexible C2S1 25 kg',
          category_path: 'Carrelage > Mortier-colle',
          price: 19.9,
        }),
      ],
      'mat-mortier-c2',
    );

    expect(result).toBeDefined();
    expect(result!.pack).toEqual({ qty: 25, unit: 'kg' });
  });

  it('refuses a 60x60 tile for a 30x30 material', () => {
    expect(
      matchFor(
        [
          product({
            title: 'Carrelage extérieur antidérapant 60x60 cm 1,44 m²',
            category_path: 'Carrelage',
          }),
        ],
        'mat-carrelage-30',
      ),
    ).toBeUndefined();
  });

  it('matches across the two notations of a glued unit', () => {
    const result = matchFor(
      [
        product({
          title: 'Lambris PVC couleur chêne 2,6 m',
          category_path: 'Revêtement mural > Lambris',
          price: 12.5,
        }),
      ],
      'mat-lambris',
    );

    expect(result).toBeDefined();
    expect(result!.pack).toEqual({ qty: 2.6, unit: 'm' });
  });

  it('rejects a product from an unrelated rayon', () => {
    expect(
      matchFor(
        [
          product({
            title: 'Tuyau d’arrosage extensible 15 m',
            category_path: 'Jardin > Arrosage',
          }),
        ],
        'mat-paint-satin',
      ),
    ).toBeUndefined();
  });

  it('lets the title rescue a product filed under a wrong category path', () => {
    // Les chemins de catégorie des flux d'affiliation sont peu fiables : le
    // filtre porte sur « catégorie + titre », pas sur la seule catégorie.
    const result = matchFor(
      [
        product({
          title: 'Peinture acrylique satinée blanche 2,5 L',
          category_path: 'Jardin > Arrosage',
        }),
      ],
      'mat-paint-satin',
    );

    expect(result).toBeDefined();
  });

  it('rejects a product with no packaging in the material grandeur', () => {
    // Titre sans volume : `unit_price * units_needed` serait incalculable.
    expect(
      matchFor(
        [
          product({
            title: 'Peinture acrylique satinée blanche',
            category_path: 'Peinture',
          }),
        ],
        'mat-paint-satin',
      ),
    ).toBeUndefined();
  });

  it('rejects a product whose packaging is in the wrong grandeur', () => {
    expect(
      matchFor(
        [
          product({
            title: 'Peinture acrylique satinée blanche 12 m²',
            category_path: 'Peinture',
          }),
        ],
        'mat-paint-satin',
      ),
    ).toBeUndefined();
  });

  it('ignores products with no usable price', () => {
    expect(
      matchFor(
        [
          product({
            title: 'Peinture acrylique satinée blanche 2,5 L',
            category_path: 'Peinture',
            price: 0,
          }),
        ],
        'mat-paint-satin',
      ),
    ).toBeUndefined();
  });

  it('keeps the cheapest per litre when two products tie on score', () => {
    const result = matchFor(
      [
        product({
          external_id: 'EXPENSIVE',
          title: 'Peinture acrylique satinée 2,5 L',
          category_path: 'Peinture',
          price: 40,
        }),
        product({
          external_id: 'CHEAP',
          title: 'Peinture acrylique satinée 2,5 L',
          category_path: 'Peinture',
          price: 28,
        }),
      ],
      'mat-paint-satin',
    );

    expect(result!.product.external_id).toBe('CHEAP');
  });

  it('is independent of feed row order', () => {
    const rows = [
      product({
        external_id: 'B',
        title: 'Peinture acrylique satinée 2,5 L',
        category_path: 'Peinture',
        price: 30,
      }),
      product({
        external_id: 'A',
        title: 'Peinture acrylique satinée 2,5 L',
        category_path: 'Peinture',
        price: 30,
      }),
    ];

    const forward = matchFor(rows, 'mat-paint-satin');
    const backward = matchFor([...rows].reverse(), 'mat-paint-satin');
    expect(forward!.product.external_id).toBe(backward!.product.external_id);
    expect(forward!.product.external_id).toBe('A');
  });

  it('skips a material whose unit cannot be priced safely', () => {
    const matcher = new MaterialProductMatcher([
      {
        material_id: 'mat-weird',
        name: 'Peinture acrylique satinée',
        category: 'painting',
        unit: 'rouleau',
      },
    ]);
    matcher.consider(
      product({
        title: 'Peinture acrylique satinée 2,5 L',
        category_path: 'Peinture',
      }),
    );

    expect(matcher.results()).toHaveLength(0);
    expect(matcher.stats().targets).toBe(0);
  });

  it('reports scan statistics', () => {
    const matcher = new MaterialProductMatcher(TARGETS);
    matcher.consider(
      product({
        title: 'Peinture acrylique satinée 2,5 L',
        category_path: 'Peinture',
      }),
    );
    matcher.consider(
      product({ title: 'Tondeuse thermique', category_path: 'Jardin' }),
    );

    expect(matcher.stats()).toEqual({
      targets: TARGETS.length,
      considered: 2,
      matched: 1,
    });
  });
});
