import { PdfBuilder } from './pdf-builder';

/**
 * Les mentions légales de l'émetteur, composées une seule fois pour le devis
 * **et** pour la facture.
 *
 * Pourquoi ici. `docs/CONFORMITE_FACTURATION.md` déclare l'assurance décennale
 * obligatoire « sur les devis et les factures » (art. L243-2 du code des
 * assurances), et le RCS/RM comme la TVA le sont sur tout document commercial.
 * Le PDF de facture les imprimait ; celui de devis n'imprimait que la raison
 * sociale, l'adresse, le téléphone et le SIRET. Recopier les quatre fonctions
 * de `InvoicePdfService` dans `QuotePdfService` aurait posé la deuxième copie
 * d'une règle de droit — et laissé la troisième à écrire le jour où un avoir ou
 * une facture d'acompte arrive (leçon 5). Elles vivent donc dans un seul
 * module, que les deux services appellent.
 *
 * Les deux appelants n'ont pas le même objet : la facture rend un
 * `InvoicePartySnapshot` figé à l'émission, le devis lit le `CompanyProfile`
 * courant. C'est voulu — une facture réimprimée dix ans plus tard doit être
 * identique à l'originale, un devis en brouillon doit suivre le profil. D'où
 * cette interface étroite, que les deux satisfont.
 */
export interface SellerLegalMentions {
  siret: string | null;
  /** Le SIREN n'est pas stocké : il se dérive du SIRET (`siretToSiren`). */
  siren: string | null;
  vat_number: string | null;
  /**
   * Facultatifs au sens du **type**, pas du droit : un `seller_snapshot` figé
   * avant que ces champs n'existent ne les porte pas, et une facture émise à
   * cette époque doit se réimprimer telle qu'elle était. Le contrôle qui les
   * exige est en amont, à l'émission (`findMissingLegalMentions`) ; ici on
   * imprime ce qui est là.
   */
  vat_exempt?: boolean;
  legal_form?: string | null;
  capital_social?: number | null;
  rcs_city?: string | null;
  rm_department?: string | null;
  insurance_name?: string | null;
  insurance_policy?: string | null;
  insurance_coverage?: string | null;
}

/** Les neuf premiers chiffres du SIRET. `null` reste `null`. */
export function siretToSiren(siret: string | null): string | null {
  return siret ? siret.slice(0, 9) : null;
}

/**
 * RCS pour les sociétés commerciales, répertoire des métiers pour les artisans.
 * L'un **ou** l'autre : `findMissingLegalMentions` exige qu'au moins un soit
 * renseigné, jamais les deux.
 */
export function registrationLine(seller: SellerLegalMentions): string | null {
  if (seller.rcs_city) {
    return `RCS ${seller.rcs_city} ${seller.siren ?? ''}`.trim();
  }
  if (seller.rm_department) {
    return `Répertoire des métiers : ${seller.siren ?? ''} RM ${seller.rm_department}`.trim();
  }
  return null;
}

/**
 * Forme juridique et capital social — obligatoires pour les sociétés
 * seulement, donc imprimés s'ils sont là et tus sinon (mention non bloquante,
 * cf. `invoice-legal-mentions.ts`).
 */
export function legalFormLine(seller: SellerLegalMentions): string | null {
  if (!seller.legal_form) return null;
  if (seller.capital_social == null) return seller.legal_form;
  return `${seller.legal_form} au capital de ${PdfBuilder.formatPrice(Number(seller.capital_social))} EUR`;
}

/**
 * Numéro de TVA intracommunautaire, ou la mention d'exonération qui le
 * remplace en franchise en base. Jamais rien : l'absence des deux est
 * précisément ce que le contrôle bloquant interdit.
 */
export function vatLine(seller: SellerLegalMentions): string {
  return seller.vat_exempt
    ? 'TVA non applicable, art. 293 B du CGI'
    : `TVA intracom. : ${seller.vat_number ?? '-'}`;
}

/** Assureur, contrat et couverture géographique (art. L243-2 c. assurances). */
export function insuranceLine(seller: SellerLegalMentions): string | null {
  if (!seller.insurance_name) return null;
  const policy = seller.insurance_policy
    ? ` — contrat ${seller.insurance_policy}`
    : '';
  return `Assurance décennale : ${seller.insurance_name}${policy} — couverture : ${seller.insurance_coverage ?? '-'}`;
}
