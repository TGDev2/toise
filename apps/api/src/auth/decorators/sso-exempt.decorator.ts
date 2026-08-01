import { SetMetadata } from '@nestjs/common';

export const SSO_EXEMPT_KEY = 'sso_exempt';

/**
 * Dispense une route de l'enforcement SSO (BACKLOG PLAT-6 D10).
 *
 * Sans elle, un salarié membre d'une organisation en enforcement et connecté par
 * mot de passe serait dans une impasse : refusé partout, **y compris** sur les
 * routes qui lui permettraient de constater le problème (`/auth/sync`,
 * `/auth/me`) et de revenir à son espace personnel (`/organizations/mine`,
 * `/organizations/:id/activate`).
 *
 * L'absence du décorateur vaut enforcement : la dispense est donc explicite,
 * greppable, et une nouvelle route est protégée par défaut.
 */
export const SsoExempt = () => SetMetadata(SSO_EXEMPT_KEY, true);
