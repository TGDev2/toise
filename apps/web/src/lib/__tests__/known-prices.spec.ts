import {
  formatKnownPrice,
  formatKnownPriceAmount,
  indexKnownPrices,
  type KnownPrice,
} from '../known-prices';

function makeKnownPrice(overrides: Partial<KnownPrice> = {}): KnownPrice {
  return {
    item_id: 'mat-paint',
    real_unit_price: 45.9,
    store_name: 'Leroy Merlin',
    recorded_on: '2026-06-12',
    project_name: 'Chantier Dupont',
    ...overrides,
  };
}

describe('known-prices', () => {
  it('formate le montant à la française', () => {
    expect(formatKnownPriceAmount(45.9)).toBe('45,90 €');
    expect(formatKnownPriceAmount(7)).toBe('7,00 €');
  });

  it('nomme le magasin et la date du relevé', () => {
    expect(formatKnownPrice(makeKnownPrice())).toBe(
      'Dernier prix : 45,90 € — Leroy Merlin, 12 juin 2026',
    );
  });

  it('reste lisible sans magasin', () => {
    expect(formatKnownPrice(makeKnownPrice({ store_name: null }))).toBe(
      'Dernier prix : 45,90 € — 12 juin 2026',
    );
  });

  /*
    L'année n'est pas décorative : un tarif de peinture de l'an dernier ne se
    reprend pas comme celui du mois dernier, et « 12 juin » ne dit pas lequel
    des deux c'est.
  */
  it("porte toujours l'année", () => {
    expect(formatKnownPrice(makeKnownPrice({ recorded_on: '2025-06-12' }))).toContain(
      '2025',
    );
  });

  /*
    `new Date('2026-01-01')` est lu en UTC puis rendu en heure locale : à l'ouest
    de Greenwich il affiche le 31 décembre. Le format construit la date depuis
    ses composants, en local.
    Ce test ne vaut que là où il est joué : ce qu'il garde, c'est que la date
    rendue est bien celle qui a été enregistrée, pas celle d'un décalage.
  */
  it('ne décale pas la date au passage du fuseau', () => {
    expect(formatKnownPrice(makeKnownPrice({ recorded_on: '2026-01-01' }))).toContain(
      '1 janv. 2026',
    );
  });

  it('indexe par identifiant d’article', () => {
    const index = indexKnownPrices([
      makeKnownPrice(),
      makeKnownPrice({ item_id: 'mat-undercoat', real_unit_price: 22 }),
    ]);
    expect(index.get('mat-paint')?.real_unit_price).toBe(45.9);
    expect(index.get('mat-undercoat')?.real_unit_price).toBe(22);
    expect(index.get('mat-absent')).toBeUndefined();
  });
});
