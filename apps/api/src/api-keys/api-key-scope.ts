import type { SubscriptionTier } from '../users/entities/user.entity';

/**
 * Portée d'une requête authentifiée par clé d'API (BACKLOG PLAT-5).
 *
 * Délibérément distinct d'`OrgScope` : il n'y a **pas d'utilisateur** derrière
 * une clé. Fabriquer un `OrgScope` avec un `user` factice ferait entrer un
 * appel machine dans des chemins qui supposent une personne — dont
 * `resolveForUser`, qui crée paresseusement une organisation personnelle.
 */
export interface ApiKeyScope {
  apiKeyId: string;
  organizationId: string;
  effectiveTier: SubscriptionTier;
}
