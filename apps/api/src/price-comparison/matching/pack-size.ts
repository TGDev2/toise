/**
 * Lecture du conditionnement d'un produit marchand, et mise à l'échelle de son
 * prix vers le conditionnement retenu par le devis.
 *
 * Le moteur d'estimation choisit un conditionnement par projet
 * (`EstimationEngine.selectBestPackaging`) et raisonne ensuite en **nombre de
 * colis** : `units_needed` compte des pots, des sacs, des boîtes. Le service de
 * comparaison multiplie `unit_price * units_needed`
 * (`price-comparison.service.ts:124`), donc `unit_price` doit être le prix d'un
 * colis *au format du devis* — pas le prix du colis du marchand.
 */
import { normalizeText } from './text-normalize';

export type PackDimension = 'L' | 'kg' | 'm2' | 'm' | 'unit';

export interface PackSize {
  qty: number;
  unit: PackDimension;
}

/** `materials_catalog.unit` ne prend que ces cinq valeurs. */
const MATERIAL_UNIT_DIMENSIONS: Record<string, PackDimension> = {
  m2: 'm2',
  l: 'L',
  kg: 'kg',
  m: 'm',
  unit: 'unit',
};

export function materialUnitDimension(unit: string): PackDimension | null {
  return MATERIAL_UNIT_DIMENSIONS[unit.trim().toLowerCase()] ?? null;
}

/**
 * Multiplicateur « lot de N ». Volontairement limité à la forme explicite :
 * un « boîte de 11 carreaux » décrit le contenu du colis, pas un lot de 11
 * colis, et le prendre pour un multiplicateur surestimerait le conditionnement
 * d'un facteur 11.
 */
const LOT_PATTERN = /(?:lot|paquet|pack|colis|set|carton)\s+de\s+(\d+)\b/;

/** Nombre de pièces, utilisé seulement quand le matériau se compte à l'unité. */
const PIECES_PATTERN =
  /(\d+)\s*(?:pieces?|carreaux|dalles|lames|plaques|rouleaux|sachets?)\b/;

const NUM = String.raw`(\d+(?:\.\d+)?)`;

/**
 * Motifs par dimension, essayés dans l'ordre. Le second membre convertit vers
 * l'unité canonique (g → kg, ml → L).
 */
const DIMENSION_PATTERNS: Record<
  Exclude<PackDimension, 'unit'>,
  { pattern: RegExp; scale: number; maxQty?: number }[]
> = {
  m2: [{ pattern: new RegExp(`${NUM}\\s*m2\\b`), scale: 1 }],
  kg: [
    { pattern: new RegExp(`${NUM}\\s*kg\\b`), scale: 1 },
    { pattern: new RegExp(`${NUM}\\s*g\\b`), scale: 0.001 },
  ],
  L: [
    { pattern: new RegExp(`${NUM}\\s*ml\\b`), scale: 0.001 },
    { pattern: new RegExp(`${NUM}\\s*(?:l|litres?)\\b`), scale: 1 },
  ],
  m: [
    { pattern: new RegExp(`${NUM}\\s*(?:m|metres?)\\b`), scale: 1 },
    // « ml » est ambigu en français : millilitre ou mètre linéaire. Une
    // plinthe de 2,6 ml est plausible, un lambris de 500 ml ne l'est pas —
    // au-delà de 20 on considère qu'il s'agit d'un volume.
    { pattern: new RegExp(`${NUM}\\s*ml\\b`), scale: 1, maxQty: 20 },
  ],
};

/**
 * Extrait le conditionnement exprimé dans `text` pour la dimension attendue.
 *
 * La dimension est imposée par le matériau plutôt que devinée : un titre comme
 * « Peinture mate 2,5 L - rendement 12 m² » porte deux grandeurs, et seule
 * celle du matériau (ici le litre) décrit ce que l'on achète.
 */
export function parsePackSize(
  text: string,
  dimension: PackDimension,
): PackSize | null {
  const normalized = normalizeText(text);
  const lotMatch = LOT_PATTERN.exec(normalized);
  const lotMultiplier = lotMatch ? Number(lotMatch[1]) : null;

  if (dimension === 'unit') {
    const piecesMatch = PIECES_PATTERN.exec(normalized);
    const qty = lotMultiplier ?? (piecesMatch ? Number(piecesMatch[1]) : 1);
    return qty > 0 ? { qty, unit: 'unit' } : null;
  }

  for (const { pattern, scale, maxQty } of DIMENSION_PATTERNS[dimension]) {
    const match = pattern.exec(normalized);
    if (!match) {
      continue;
    }
    const raw = Number(match[1]);
    if (!Number.isFinite(raw) || raw <= 0 || (maxQty != null && raw > maxQty)) {
      continue;
    }
    const qty = raw * scale * (lotMultiplier ?? 1);
    return qty > 0 ? { qty, unit: dimension } : null;
  }

  return null;
}

/**
 * Bornes du prorata. Au-delà, le produit n'est plus le même type de bien : un
 * sac de 5 kg et un sac de 25 kg de mortier se vendent au kilo à des prix très
 * différents, et extrapoler l'un depuis l'autre serait inventer un prix.
 */
export const MIN_PACK_RATIO = 0.25;
export const MAX_PACK_RATIO = 4;

/**
 * Ramène le prix du colis marchand au colis du devis.
 *
 * Renvoie `null` — donc `not_found` en bout de chaîne — plutôt qu'un prix
 * douteux dès que le rapport de conditionnement sort de la bande admise.
 */
export function proratePrice(
  productPrice: number,
  productPackQty: number,
  targetPackQty: number,
): number | null {
  if (
    !Number.isFinite(productPrice) ||
    productPrice <= 0 ||
    !Number.isFinite(productPackQty) ||
    productPackQty <= 0 ||
    !Number.isFinite(targetPackQty) ||
    targetPackQty <= 0
  ) {
    return null;
  }

  const ratio = targetPackQty / productPackQty;
  if (ratio < MIN_PACK_RATIO || ratio > MAX_PACK_RATIO) {
    return null;
  }

  return Math.round(productPrice * ratio * 100) / 100;
}
