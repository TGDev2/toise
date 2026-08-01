import type { CompanyProfile } from '../company-profiles/entities/company-profile.entity';

/** Clés renvoyées au client dans le corps du 400 `MISSING_LEGAL_MENTIONS`. */
export type MissingLegalMention =
  | 'vat_number'
  | 'registration'
  | 'insurance'
  | 'address'
  | 'siret';

/**
 * Mentions légales sans lesquelles une facture d'artisan n'est pas émettable.
 *
 * La liste est délibérément courte. Sont **bloquantes** :
 * - `vat_number` : numéro de TVA intracommunautaire, sauf franchise en base
 *   (art. 293 B du CGI), auquel cas la mention d'exonération le remplace ;
 * - `registration` : ville du RCS (sociétés commerciales) **ou** département du
 *   répertoire des métiers (artisans) ;
 * - `insurance` : assureur et couverture géographique de la décennale —
 *   art. L243-2 du code des assurances, non négociable pour le BTP.
 *
 * Sont volontairement **non bloquantes** : `legal_form` et `capital_social`, qui
 * ne sont obligatoires que pour les sociétés et ne se déduisent pas de façon
 * fiable des données saisies. Un 400 abusif qui empêche un artisan de facturer
 * coûte plus cher qu'une mention facultative absente : elles sont imprimées si
 * présentes, ignorées sinon.
 */
export function findMissingLegalMentions(
  profile: CompanyProfile,
): MissingLegalMention[] {
  const missing: MissingLegalMention[] = [];

  if (!profile.siret) {
    missing.push('siret');
  }

  if (!profile.address_line1 || !profile.postal_code || !profile.city) {
    missing.push('address');
  }

  if (!profile.vat_exempt && !profile.vat_number) {
    missing.push('vat_number');
  }

  if (!profile.rcs_city && !profile.rm_department) {
    missing.push('registration');
  }

  if (!profile.insurance_name || !profile.insurance_coverage) {
    missing.push('insurance');
  }

  return missing;
}
