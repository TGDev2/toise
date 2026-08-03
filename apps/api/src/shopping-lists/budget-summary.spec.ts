import {
  computeBudgetSummary,
  type BudgetEstimationLine,
} from './budget-summary';
import type {
  ShoppingListComplementaryItem,
  ShoppingListData,
  ShoppingListMaterialItem,
} from './entities/shopping-list.entity';

const POT_LITRES = 5;
const POT_PRICE = 45;

/**
 * Les trois facteurs de perte réellement seedés pour la peinture
 * (`seed-catalog.data.ts`, `paintWaste`). Ce sont eux qui produisaient une
 * économie négative pour un débutant et une économie fictive pour un expert.
 */
const SKILL_LEVELS = [
  { level: 'débutant', waste_percent: 15 },
  { level: 'intermédiaire', waste_percent: 10 },
  { level: 'expert', waste_percent: 5 },
] as const;

function paint(
  overrides: Partial<ShoppingListMaterialItem> = {},
): ShoppingListMaterialItem {
  return {
    material_id: 'mat-paint',
    work_type_code: 'wall_painting',
    work_type_label: 'Peinture murale',
    material_name: 'Peinture acrylique mate',
    material_category: 'painting',
    material_unit: 'L',
    packaging_label: 'Pot 5 L',
    packaging_qty_per_unit: POT_LITRES,
    adjusted_qty: 11,
    original_units_needed: 3,
    units_needed: 3,
    is_manually_adjusted: false,
    real_unit_price: POT_PRICE,
    ...overrides,
  };
}

function complement(
  overrides: Partial<ShoppingListComplementaryItem> = {},
): ShoppingListComplementaryItem {
  return {
    complementary_material_id: 'comp-tape',
    name: 'Ruban de masquage',
    description_fr: '',
    category: 'painting',
    unit_label: 'rouleau',
    default_quantity: 2,
    quantity: 2,
    is_removed: false,
    real_unit_price: 6,
    ...overrides,
  };
}

function list(
  material_items: ShoppingListMaterialItem[],
  complementary_items: ShoppingListComplementaryItem[] = [],
): ShoppingListData {
  return { material_items, complementary_items };
}

/**
 * Deux pièces de 5 L de besoin net chacune, majorées du facteur du niveau.
 *
 * Pièce par pièce : 2 pots par pièce, soit 4. Mutualisé : `ceil(2 × 5 × (1+w) / 5)`
 * = 3 pots pour les trois niveaux. L'économie mesurée est donc d'un pot,
 * identique aux trois niveaux — c'est l'arrondi, pas la marge de perte.
 */
function twoRooms(wastePercent: number): BudgetEstimationLine[] {
  const perRoom = 5 * (1 + wastePercent / 100);
  return [
    { material_id: 'mat-paint', adjusted_qty: perRoom },
    { material_id: 'mat-paint', adjusted_qty: perRoom },
  ];
}

describe('computeBudgetSummary — économie de mutualisation', () => {
  /**
   * E1-8, le défaut central : le coût « brut » appliquait 10 % de perte
   * forfaitaire là où le coût réel portait le facteur du niveau déclaré.
   * Un débutant (15 %) voyait donc une économie **négative** — l'écran lui
   * reprochait d'avoir prévu la casse — et un expert (5 %) une économie qui
   * n'était que la trace d'une case cochée dans un formulaire.
   *
   * Le niveau de compétence est désormais des deux côtés de la comparaison :
   * il ne peut plus la déplacer.
   */
  it.each(SKILL_LEVELS)(
    'annonce la même économie à un $level ($waste_percent % de perte)',
    ({ waste_percent }) => {
      const summary = computeBudgetSummary(
        list([paint()]),
        twoRooms(waste_percent),
      );

      expect(summary.total_real_cost).toBe(135); // 3 pots réellement achetés
      expect(summary.total_brute_cost).toBe(180); // 4 pots, pièce par pièce
      expect(summary.savings_amount).toBe(45); // le pot que l'arrondi a évité
      expect(summary.savings_percent).toBe(25);
    },
  );

  it.each(SKILL_LEVELS)(
    'tient l’invariant brut = réel + économie ≥ réel pour un $level',
    ({ waste_percent }) => {
      const summary = computeBudgetSummary(
        list([paint()], [complement()]),
        twoRooms(waste_percent),
      );

      expect(summary.savings_amount).toBeGreaterThanOrEqual(0);
      expect(summary.total_brute_cost).toBeCloseTo(
        summary.total_real_cost + summary.savings_amount,
        2,
      );
    },
  );

  /**
   * Le pendant du cas précédent : sans mutualisation, il n'y a rien à annoncer.
   * L'ancien calcul créditait pourtant l'expert d'une économie sur ce chantier
   * — l'écart entre son facteur (5 %) et le forfait de 10 %, c'est-à-dire un
   * paramètre qu'il avait lui-même choisi.
   */
  it('n’annonce aucune économie sur un chantier d’une seule pièce', () => {
    const summary = computeBudgetSummary(list([paint()]), [
      { material_id: 'mat-paint', adjusted_qty: 10.5 },
    ]);

    expect(summary.savings_amount).toBe(0);
    expect(summary.savings_percent).toBe(0);
    expect(summary.total_brute_cost).toBe(summary.total_real_cost);
  });

  /**
   * Une correction manuelle est une décision de l'utilisateur, pas un gain de
   * l'outil : la référence mutualisée reste `original_units_needed`. L'écart
   * est **marginal** — il s'ajoute à l'achat réellement fait, quel qu'il soit.
   */
  it('mesure l’écart contre l’achat mutualisé d’origine, pas contre la correction manuelle', () => {
    const summary = computeBudgetSummary(
      list([paint({ units_needed: 2, is_manually_adjusted: true })]),
      twoRooms(10),
    );

    expect(summary.total_real_cost).toBe(90);
    expect(summary.savings_amount).toBe(45);
    expect(summary.total_brute_cost).toBe(135);
  });

  it('n’invente pas d’économie sur un matériau sans ligne d’estimation', () => {
    const summary = computeBudgetSummary(
      list([paint({ material_id: 'mat-orphan' })]),
      twoRooms(10),
    );

    expect(summary.total_real_cost).toBe(135);
    expect(summary.savings_amount).toBe(0);
  });

  it('ne compte aucune économie sur les consommables, qui n’ont rien à mutualiser', () => {
    const summary = computeBudgetSummary(
      list([], [complement({ quantity: 4, real_unit_price: 6 })]),
      [],
    );

    expect(summary.total_real_cost).toBe(24);
    expect(summary.savings_amount).toBe(0);
    expect(summary.total_brute_cost).toBe(24);
  });

  it('ventile l’économie par catégorie, brut = réel + économie', () => {
    const summary = computeBudgetSummary(
      list([
        paint(),
        paint({
          material_id: 'mat-tile',
          material_category: 'tiling',
          packaging_qty_per_unit: 1.44,
          original_units_needed: 8,
          units_needed: 8,
          real_unit_price: 22.9,
        }),
      ]),
      [
        ...twoRooms(10),
        { material_id: 'mat-tile', adjusted_qty: 5.5 },
        { material_id: 'mat-tile', adjusted_qty: 5.5 },
      ],
    );

    // Carrelage : 4 cartons par pièce (ceil(5.5/1.44)), soit 8 — exactement
    // l'achat mutualisé (ceil(11/1.44) = 8). Rien à annoncer de ce côté.
    expect(summary.by_category).toEqual([
      {
        category: 'painting',
        label: 'Peinture',
        real_cost: 135,
        brute_cost: 180,
      },
      {
        category: 'tiling',
        label: 'Carrelage',
        real_cost: 183.2,
        brute_cost: 183.2,
      },
    ]);
  });
});

describe('computeBudgetSummary — quantité valorisée', () => {
  /**
   * E1-8, second défaut : ce calcul multipliait le prix réel par
   * `units_needed` — la liste de courses — pendant que le benchmark de coûts
   * (DATA-4) le multipliait par la quantité déclarée. Deux « coûts réels »
   * contradictoires pour le même chantier, sur le même écran.
   */
  it('valorise la quantité déclarée quand elle existe', () => {
    const summary = computeBudgetSummary(
      list([paint({ units_needed: 3, purchased_units: 4 })]),
      twoRooms(10),
    );

    expect(summary.total_real_cost).toBe(180);
  });

  it('retombe sur la quantité prévue tant que rien n’est déclaré', () => {
    const summary = computeBudgetSummary(list([paint()]), twoRooms(10));

    expect(summary.total_real_cost).toBe(135);
  });

  /** Une déclaration à zéro est une déclaration : le matériau a été écarté. */
  it('honore une quantité déclarée nulle', () => {
    const summary = computeBudgetSummary(
      list([paint({ purchased_units: 0 })]),
      twoRooms(10),
    );

    expect(summary.total_real_cost).toBe(0);
    expect(summary.items_priced).toBe(1);
  });

  /**
   * Repli historique de `declaredPurchasedUnits` : avant DATA-5, une ligne
   * corrigée à la main était la seule trace d'un achat réel.
   */
  it('lit une ligne corrigée à la main comme une déclaration', () => {
    const summary = computeBudgetSummary(
      list([paint({ units_needed: 4, is_manually_adjusted: true })]),
      twoRooms(10),
    );

    expect(summary.total_real_cost).toBe(180);
  });

  it('applique la même règle aux consommables', () => {
    const summary = computeBudgetSummary(
      list([], [complement({ quantity: 2, purchased_quantity: 5 })]),
      [],
    );

    expect(summary.total_real_cost).toBe(30);
  });

  it('ignore une ligne sans prix réel et un consommable retiré', () => {
    const summary = computeBudgetSummary(
      list(
        [paint({ real_unit_price: null })],
        [complement({ is_removed: true }), complement({ real_unit_price: 6 })],
      ),
      twoRooms(10),
    );

    expect(summary.total_real_cost).toBe(12);
    expect(summary.items_priced).toBe(1);
    expect(summary.items_total).toBe(2);
    expect(summary.is_complete).toBe(false);
  });
});
