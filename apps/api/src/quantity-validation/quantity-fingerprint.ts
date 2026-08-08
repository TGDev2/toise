import { createHash } from 'crypto';
import type { ShoppingListMaterialItem } from '../shopping-lists/entities/shopping-list.entity';
import type { ValidatedQuantityLine } from './entities/quantity-validation.entity';

/**
 * E2-4 — l'empreinte des quantités validées.
 *
 * Une seule définition, appelée par le service de validation **et** par la
 * garde d'émission. Deux calculs concurrents de la même empreinte auraient
 * fini par diverger sur un arrondi, et c'est la garde qui aurait cédé (leçon
 * 15).
 */

/**
 * Les quantités validées sont celles qui figureront sur le devis, c'est-à-dire
 * les lignes chiffrées — le filtre exact de `QuotesService.create`.
 *
 * Valider une ligne sans prix serait valider ce qui n'est pas émis ; ne pas
 * valider une ligne chiffrée laisserait passer sur le devis une quantité que
 * personne n'a regardée. Conséquence assumée : renseigner un prix de plus après
 * la validation la périme, et il faut revalider. C'est le comportement juste —
 * la quantité de cette ligne-là n'avait jamais été validée.
 */
export function selectQuotableItems(
  items: ShoppingListMaterialItem[],
): ShoppingListMaterialItem[] {
  return items.filter(
    (item) => item.real_unit_price != null && item.real_unit_price > 0,
  );
}

/**
 * Arrondi au millième, la précision de `quantity_corrections.computed_units`.
 * Sans lui, `0.1 + 0.2` et `0.3` produiraient deux empreintes différentes pour
 * la même quantité affichée, et la garde refuserait un devis légitime.
 */
function normaliseUnits(units: number): number {
  return Math.round(units * 1000) / 1000;
}

export function toValidatedLines(
  items: ShoppingListMaterialItem[],
): ValidatedQuantityLine[] {
  return selectQuotableItems(items)
    .map((item) => ({
      material_id: item.material_id,
      material_name: item.material_name,
      work_type_code: item.work_type_code,
      work_type_label: item.work_type_label,
      packaging_label: item.packaging_label,
      units_needed: normaliseUnits(item.units_needed),
    }))
    .sort((a, b) => a.material_id.localeCompare(b.material_id));
}

/**
 * `sha256` de `material_id:units_needed`, une ligne par matériau, triées.
 *
 * Ne portent l'empreinte que l'identifiant et la quantité : ce sont les deux
 * seules grandeurs dont une variation change ce que l'artisan a engagé. Un
 * libellé de catalogue réécrit entre la validation et l'émission ne doit pas
 * bloquer un devis — il est conservé dans l'instantané, qui lui porte tout.
 */
export function fingerprintQuantities(lines: ValidatedQuantityLine[]): string {
  const canonical = lines
    .map((line) => `${line.material_id}:${line.units_needed}`)
    .sort()
    .join('\n');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/** Raccourci des deux appels, qui vont toujours ensemble. */
export function fingerprintShoppingList(items: ShoppingListMaterialItem[]): {
  lines: ValidatedQuantityLine[];
  fingerprint: string;
} {
  const lines = toValidatedLines(items);
  return { lines, fingerprint: fingerprintQuantities(lines) };
}
