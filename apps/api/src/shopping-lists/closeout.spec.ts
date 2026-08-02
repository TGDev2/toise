import {
  computeCloseout,
  type CloseoutComplementaryInput,
  type CloseoutMaterialInput,
} from './closeout';

function material(
  overrides: Partial<CloseoutMaterialInput> = {},
): CloseoutMaterialInput {
  return {
    material_id: 'mat-tiles',
    material_name: 'Carrelage grès cérame 60x60',
    material_category: 'tiling',
    material_unit: 'm2',
    packaging_label: 'Carton 1,44 m²',
    packaging_qty_per_unit: 1.44,
    estimated_units: 19,
    purchased_units: null,
    real_unit_price: 22.9,
    store_name: 'Leroy Merlin',
    theoretical_qty: 24,
    estimated_waste_percent: 12,
    ...overrides,
  };
}

function complementary(
  overrides: Partial<CloseoutComplementaryInput> = {},
): CloseoutComplementaryInput {
  return {
    complementary_material_id: 'comp-croisillons',
    name: 'Croisillons 2 mm',
    unit_label: 'sachet',
    estimated_quantity: 2,
    purchased_quantity: null,
    real_unit_price: 4.5,
    store_name: 'Leroy Merlin',
    ...overrides,
  };
}

const TODAY = '2026-08-02';
const PURCHASED_ON = '2026-07-15';

describe('computeCloseout — une ligne non déclarée ne dit rien', () => {
  it("ne fabrique ni surplus ni perte tant que l'utilisateur n'a pas déclaré", () => {
    // Le défaut que ce lot corrige : sans déclaration explicite, une ligne
    // intacte ne doit pas être lue comme « l'estimation était exacte ».
    const summary = computeCloseout([material()], [], PURCHASED_ON, TODAY);

    expect(summary.lines[0].is_declared).toBe(false);
    expect(summary.lines[0].purchased_units).toBeNull();
    expect(summary.lines[0].surplus_units).toBe(0);
    expect(summary.lines[0].implied_waste_percent).toBeNull();
    expect(summary.lines_declared).toBe(0);
    expect(summary.surplus_value_total).toBe(0);
  });

  it('déclarer exactement l’estimation est une observation, pas un silence', () => {
    const summary = computeCloseout(
      [material({ purchased_units: 19 })],
      [],
      PURCHASED_ON,
      TODAY,
    );

    expect(summary.lines[0].is_declared).toBe(true);
    expect(summary.lines[0].surplus_units).toBe(0);
    expect(summary.lines_declared).toBe(1);
    // 19 cartons de 1,44 m² pour 24 m² nets = 14 % de perte, dont rien n'est
    // imputable à l'utilisateur : c'est le plancher du conditionnement.
    expect(summary.lines[0].implied_waste_percent).toBe(14);
    expect(summary.lines[0].packaging_floor_percent).toBe(14);
  });
});

describe('computeCloseout — le chantier de la demande', () => {
  const tiles = material({ purchased_units: 21 });
  const paint = material({
    material_id: 'mat-paint',
    material_name: 'Peinture acrylique mate',
    material_category: 'painting',
    material_unit: 'L',
    packaging_label: 'Pot 10 L',
    packaging_qty_per_unit: 10,
    estimated_units: 2,
    purchased_units: 3,
    real_unit_price: 45,
    store_name: 'Castorama',
    theoretical_qty: 12,
    estimated_waste_percent: 10,
  });

  const summary = computeCloseout([tiles, paint], [], PURCHASED_ON, TODAY);
  const tileLine = summary.lines[0];
  const paintLine = summary.lines[1];

  it('compte le surplus en conditionnements et en volume', () => {
    expect(tileLine.surplus_units).toBe(2);
    expect(tileLine.surplus_volume).toBe(2.88);
    expect(tileLine.surplus_value).toBe(45.8);
  });

  it("n'annonce pas la peinture comme récupérable", () => {
    // Leroy Merlin comme Castorama excluent la peinture teintée en machine et
    // les pots descellés. Le « pot à 45 € » de la demande est précisément
    // l'article qu'il ne faut pas chiffrer comme récupéré d'avance.
    expect(paintLine.returnability).toBe('restricted');
    expect(paintLine.restriction_reason).toContain('teintée');
    expect(summary.restricted_amount).toBe(45);
    expect(summary.recoverable_amount).toBe(45.8);
    expect(summary.surplus_value_total).toBe(90.8);
  });

  it('partitionne le surplus : récupérable + sous réserve + inconnu', () => {
    expect(
      summary.recoverable_amount +
        summary.restricted_amount +
        summary.unknown_amount,
    ).toBe(summary.surplus_value_total);
  });

  it('date la reprise sur le délai publié, pas sur une croyance de 30 jours', () => {
    // Leroy Merlin publie 6 mois : un décompte à 30 jours aurait annoncé
    // « délai dépassé » le 14/08 à quelqu'un qui a jusqu'au 11/01.
    expect(tileLine.return_deadline).toBe('2027-01-11');
    expect(tileLine.days_remaining).toBe(162);
    expect(paintLine.return_deadline).toBe('2027-07-15');
    expect(summary.earliest_deadline).toBe('2027-01-11');
  });

  it("n'impute pas l'arrondi du conditionnement à l'utilisateur", () => {
    // 26 % de perte impliquée, dont 14 imposés par le carton : la marge prise
    // par l'utilisateur est de 12 points, pas de 26.
    expect(tileLine.implied_waste_percent).toBe(26);
    expect(tileLine.packaging_floor_percent).toBe(14);
    expect(tileLine.estimated_waste_percent).toBe(12);
    expect(tileLine.waste_delta_points).toBe(14);
  });
});

describe('computeCloseout — acheter moins que prévu', () => {
  it('relève un manque et une perte réelle sous l’estimation', () => {
    // Le signal qui intéresse DATA-3 : l'estimation prévoyait 12 % de perte,
    // l'utilisateur s'en est tiré avec 8 %.
    const summary = computeCloseout(
      [
        material({
          material_id: 'mat-parquet',
          material_name: 'Parquet contrecollé chêne',
          material_category: 'flooring',
          packaging_label: 'Paquet 1,8 m²',
          packaging_qty_per_unit: 1.8,
          estimated_units: 13,
          purchased_units: 12,
          theoretical_qty: 20,
          estimated_waste_percent: 12,
        }),
      ],
      [],
      PURCHASED_ON,
      TODAY,
    );

    const line = summary.lines[0];
    expect(line.shortfall_units).toBe(1);
    expect(line.surplus_units).toBe(0);
    expect(line.surplus_value).toBeNull();
    expect(line.implied_waste_percent).toBe(8);
    expect(line.waste_delta_points).toBe(-4);
    expect(summary.surplus_lines).toBe(0);
  });
});

describe('computeCloseout — ce que l’on ne sait pas', () => {
  it('n’affirme aucun délai pour une enseigne hors catalogue', () => {
    const summary = computeCloseout(
      [material({ purchased_units: 21, store_name: 'Brico Dépôt' })],
      [],
      PURCHASED_ON,
      TODAY,
    );

    expect(summary.lines[0].returnability).toBe('unknown');
    expect(summary.lines[0].policy).toBeNull();
    expect(summary.lines[0].return_deadline).toBeNull();
    expect(summary.lines[0].days_remaining).toBeNull();
    expect(summary.recoverable_amount).toBe(0);
    expect(summary.unknown_amount).toBe(45.8);
    expect(summary.unknown_retailers).toEqual(['Brico Dépôt']);
  });

  it('compte les surplus sans prix sans leur inventer de montant', () => {
    const summary = computeCloseout(
      [material({ purchased_units: 21, real_unit_price: null })],
      [],
      PURCHASED_ON,
      TODAY,
    );

    expect(summary.surplus_lines).toBe(1);
    expect(summary.unpriced_surplus_lines).toBe(1);
    expect(summary.surplus_value_total).toBe(0);
  });

  it('reste muet sur la perte quand le besoin net est inconnu', () => {
    const summary = computeCloseout(
      [material({ purchased_units: 21, theoretical_qty: null })],
      [],
      PURCHASED_ON,
      TODAY,
    );

    expect(summary.lines[0].implied_waste_percent).toBeNull();
    expect(summary.lines[0].packaging_floor_percent).toBeNull();
    expect(summary.lines[0].waste_delta_points).toBeNull();
    // Le surplus, lui, reste calculable : il ne dépend pas du besoin net.
    expect(summary.lines[0].surplus_units).toBe(2);
  });

  it("n'affiche pas d'échéance sans date d'achat", () => {
    const summary = computeCloseout(
      [material({ purchased_units: 21 })],
      [],
      null,
      TODAY,
    );

    expect(summary.lines[0].policy?.slug).toBe('leroymerlin');
    expect(summary.lines[0].return_deadline).toBeNull();
    expect(summary.earliest_deadline).toBeNull();
  });

  it('ne divise pas par zéro sur un besoin net nul', () => {
    const summary = computeCloseout(
      [material({ purchased_units: 1, theoretical_qty: 0 })],
      [],
      PURCHASED_ON,
      TODAY,
    );

    expect(summary.lines[0].implied_waste_percent).toBeNull();
  });
});

describe('computeCloseout — consommables', () => {
  it('traite les compléments comme des lignes sans statistique de perte', () => {
    const summary = computeCloseout(
      [],
      [complementary({ purchased_quantity: 4 })],
      PURCHASED_ON,
      TODAY,
    );

    const line = summary.lines[0];
    expect(line.kind).toBe('complementary');
    expect(line.surplus_units).toBe(2);
    expect(line.surplus_value).toBe(9);
    expect(line.surplus_volume).toBeNull();
    expect(line.implied_waste_percent).toBeNull();
    expect(line.returnability).toBe('likely');
    expect(summary.recoverable_amount).toBe(9);
  });
});
