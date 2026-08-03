import { SetMetadata } from '@nestjs/common';

export const REQUIRES_REGISTERED_ACCOUNT_KEY = 'requires_registered_account';

/**
 * Réserve une route aux comptes inscrits : un compte anonyme (mode invité,
 * E2-1) reçoit un 403 `ACCOUNT_REQUIRED` au lieu du service.
 *
 * À poser sur ce qui coûte durablement (stockage), sur ce qui produit un
 * artefact public (lien de partage, publication communautaire) et sur ce qui
 * vaut la création de compte — le PDF est le moment de conversion du parcours.
 * Le reste du parcours invité doit rester ouvert : c'est l'objet même d'E2-1.
 */
export const RequiresRegisteredAccount = () =>
  SetMetadata(REQUIRES_REGISTERED_ACCOUNT_KEY, true);
