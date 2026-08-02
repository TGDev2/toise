import type { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Configuration du rate limiting global. Exportée plutôt qu'écrite en ligne
 * dans `app.module.ts` pour que le test de non-régression
 * (`test/throttling.e2e-spec.ts`) exerce *cette* configuration et pas une copie.
 *
 * **Un seul limiteur, et c'est une contrainte, pas une préférence.**
 * `ThrottlerGuard.canActivate` boucle sur *tous* les limiteurs déclarés et exige
 * que *chacun* passe :
 *
 * ```js
 * for (const namedThrottler of this.throttlers) { … continues.push(…) }
 * return continues.every((cont) => cont);
 * ```
 *
 * Un limiteur nommé n'est donc pas une option que les routes concernées
 * activent : c'est un plancher que toutes les autres doivent penser à
 * désactiver. Une configuration antérieure déclarait un limiteur `auth` à
 * 5 req/15 min « pour l'authentification » — il s'appliquait en réalité à
 * l'intégralité de l'API, et 27 contrôleurs sur 39 ne le neutralisaient pas.
 *
 * Les plafonds plus stricts appartiennent aux routes qui les méritent, sous
 * forme de surcharge : `@Throttle({ default: { ttl: 900_000, limit: 5 } })`.
 * Le sens de l'oubli s'en trouve inversé — une route qu'on oublie de décorer
 * hérite du plafond permissif ci-dessous, jamais d'un plafond strict.
 */
export const THROTTLER_CONFIG: ThrottlerModuleOptions = [
  { name: 'default', ttl: 60_000, limit: 100 },
];
