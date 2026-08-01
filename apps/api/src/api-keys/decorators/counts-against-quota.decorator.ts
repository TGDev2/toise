import { SetMetadata } from '@nestjs/common';

export const COUNTS_AGAINST_QUOTA = 'counts_against_quota';

/**
 * Marque une route comme facturée au quota mensuel (BACKLOG PLAT-5).
 *
 * Opt-in et non l'inverse : compter *toutes* les routes ferait payer au client
 * la lecture de son propre quota et la liste des types de travaux, qui ne
 * calculent rien. Seuls les appels qui font travailler le moteur d'estimation
 * consomment.
 */
export const CountsAgainstQuota = () => SetMetadata(COUNTS_AGAINST_QUOTA, true);
