/**
 * Normalisation de la saisie décimale (PRO-5).
 *
 * Le parcours utilisait `<input type="number">` partout. Sur un clavier mobile
 * français, la touche de séparateur décimal est une **virgule** : `type="number"`
 * la refuse et le navigateur renvoie alors une chaîne vide. « 3,5 m » devenait
 * donc 0 ou 3 selon le navigateur — une erreur de mesure silencieuse, propagée
 * jusqu'aux quantités de matériaux et au total du devis.
 *
 * Les champs concernés passent en `type="text" inputMode="decimal"` et font
 * transiter la frappe par cette fonction : la virgule est convertie en point
 * (le format attendu par `parseFloat` en aval, inchangé), et toute frappe qui
 * ne produirait pas un décimal positif valide est refusée plutôt que stockée.
 */

/** Décimal positif : chiffres, au plus un séparateur, éventuellement partiel («
 * `12.` » pendant la frappe). La chaîne vide est acceptée (champ effaçable). */
const POSITIVE_DECIMAL = /^\d*\.?\d*$/;

/**
 * @returns la valeur normalisée (virgule → point), ou `null` si la frappe doit
 * être refusée — l'appelant conserve alors la valeur précédente.
 */
export function normalizeDecimalInput(raw: string): string | null {
  // Seule la première virgule est convertie : « 3,5,2 » échoue ensuite sur le
  // motif au lieu d'être silencieusement recollé en « 3.5.2 ».
  const unified = raw.replace(',', '.');
  if (unified === '') return '';
  if (!POSITIVE_DECIMAL.test(unified)) return null;
  return unified;
}
