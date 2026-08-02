import type { SubscriptionTier } from '../users/entities/user.entity';

/**
 * Portée d'une requête authentifiée par clé de widget (BACKLOG PLAT-7).
 *
 * Distinct d'`ApiKeyScope` (PLAT-5) : la clé de widget n'est pas un secret et
 * son autorisation repose sur l'origine de l'appelant, pas sur sa
 * confidentialité — `origin` fait donc partie de la portée au même titre que
 * l'organisation et le palier.
 */
export interface WidgetScope {
  widgetConfigId: string;
  organizationId: string;
  effectiveTier: SubscriptionTier;
  origin: string;
}
