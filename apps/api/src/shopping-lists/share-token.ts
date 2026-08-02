/**
 * Politique d'expiration des liens de partage publics de liste de courses.
 *
 * Le lien est servi sans authentification et expose le nom du projet, les
 * dimensions, et l'intégralité des `material_items` — dont `real_unit_price` et
 * `store_name` pour chaque matériau. Il circule par e-mail et messagerie : il
 * est archivé, transféré, parfois suivi par un scanner de liens. Une durée de
 * vie est la seule chose qui referme un lien que personne ne pense à révoquer.
 *
 * 90 jours : au-delà de la durée d'un chantier courant, en deçà de l'échelle où
 * un prix d'achat garde sa valeur commerciale. La révocation manuelle
 * (`revokeShareToken`) reste disponible pour fermer plus tôt.
 */
export const SHARE_TOKEN_TTL_DAYS = 90;

const TTL_MS = SHARE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

/** Date de péremption, ou `null` si l'entrée ne porte pas de lien exploitable. */
export function shareTokenExpiry(list: {
  share_token: string | null;
  share_token_created_at: Date | null;
}): Date | null {
  if (!list.share_token || !list.share_token_created_at) return null;
  return new Date(list.share_token_created_at.getTime() + TTL_MS);
}

/**
 * Un jeton sans date d'émission est traité comme expiré. Ce cas ne devrait pas
 * exister — `generateShareToken` écrit toujours les deux colonnes ensemble —
 * mais une donnée dont on ne sait pas dater l'émission ne peut pas être déclarée
 * fraîche : sur un lien public, l'inconnu se referme, il ne s'ouvre pas.
 */
export function isShareTokenExpired(
  list: {
    share_token: string | null;
    share_token_created_at: Date | null;
  },
  now: Date = new Date(),
): boolean {
  if (!list.share_token) return true;
  const expiry = shareTokenExpiry(list);
  return expiry === null || expiry.getTime() <= now.getTime();
}
