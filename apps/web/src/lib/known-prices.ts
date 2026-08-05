/**
 * E4-4 — rappel du dernier prix relevé par l'entreprise pour un article.
 *
 * L'étape « Prix » pèse 57 % du temps d'écran d'un chantier à trois corps
 * d'état (`docs/AUDIT_PARCOURS_10MIN.md`), et l'artisan y ressaisit des tarifs
 * qu'il a déjà donnés au produit sur le chantier précédent.
 *
 * Le rappel est **proposé, jamais appliqué tout seul** : `real_unit_price`
 * alimente le budget et le benchmark DATA-4, et un prix posé sans que personne
 * ne le regarde deviendrait indiscernable d'un relevé de terrain.
 */
export interface KnownPrice {
  /** `material_id` pour un matériau, `complementary_material_id` pour un complément. */
  item_id: string;
  real_unit_price: number;
  store_name: string | null;
  /** `yyyy-mm-dd`, date de dernière écriture de la liste d'origine. */
  recorded_on: string;
  project_name: string;
}

export interface KnownPricesResponse {
  materials: KnownPrice[];
  complements: KnownPrice[];
}

export function indexKnownPrices(prices: KnownPrice[]): Map<string, KnownPrice> {
  return new Map(prices.map((p) => [p.item_id, p]));
}

/**
 * `new Date('2026-08-05')` est interprété en UTC puis rendu en heure locale :
 * à l'ouest de Greenwich, la date recule d'un jour. On construit donc la date
 * depuis ses composants, en local.
 */
function parseIsoDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatKnownPriceAmount(price: number): string {
  return `${price.toFixed(2).replace('.', ',')} €`;
}

/**
 * L'année est toujours affichée : un tarif de peinture de l'an dernier ne se
 * reprend pas comme celui du mois dernier, et « 12 juin » ne dit pas lequel
 * des deux c'est.
 */
export function formatKnownPrice(known: KnownPrice): string {
  const day = parseIsoDay(known.recorded_on);
  const when = day
    ? new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(day)
    : known.recorded_on;
  const amount = formatKnownPriceAmount(known.real_unit_price);
  return known.store_name
    ? `Dernier prix : ${amount} — ${known.store_name}, ${when}`
    : `Dernier prix : ${amount} — ${when}`;
}
