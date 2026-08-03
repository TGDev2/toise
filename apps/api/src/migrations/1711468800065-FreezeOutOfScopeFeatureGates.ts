import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR 0001, décisions D2 et D3 — gel des surfaces hors périmètre V1.
 *
 * Huit gates passent à `is_enabled = false`. Le gel est un **état**, pas une
 * suppression : les lignes restent en base avec leur `id`, leur `label_fr`,
 * leur `description_fr` et leur `min_tier` intacts. C'est ce qui distingue
 * cette migration d'un `DELETE` dont le `down()` réinsérerait des lignes
 * nouvelles, avec de nouveaux `id` et un libellé recopié à la main — donc
 * susceptible d'avoir dérivé.
 *
 * Pourquoi ces huit-là (ADR 0001 §3.3, §5.3) :
 *
 * - `cv_analysis` — D2. La précision du service de vision n'a jamais été
 *   mesurée sur une seule photo réelle ; le service sort de la production.
 * - `public_api`, `enterprise_sso`, `multi_user` — D3. Livrées, facturées,
 *   atteignables depuis aucune interface. Le SSO est de surcroît appliqué dans
 *   `FirebaseAuthGuard`, donc sur le chemin critique de toute requête
 *   authentifiée.
 * - `cost_benchmark` — D3. Sans signal avant plusieurs centaines de chantiers
 *   clôturés, et structurellement faussé aujourd'hui.
 * - `eco_materials`, `site_tracking`, `quote_reminders` — D3. Hors de la
 *   promesse V1 (« chiffrer juste un ouvrage de finition, envoyer le devis »).
 *
 * `down()` repose les huit à `true`, ce qui est exactement leur état avant ce
 * lot : `cv_analysis` par le défaut de la table (#017), `site_tracking` (#039),
 * `quote_reminders` (#041), `eco_materials` (#053), `multi_user` (#054),
 * `public_api` (#055), `enterprise_sso` (#056) et `cost_benchmark` (#060) — les
 * quatre gates seedées éteintes en #037 ayant toutes été rallumées depuis avec
 * leur code. Réserve honnête : `PUT /admin/feature-gates/:key` permet à un
 * administrateur d'éteindre une gate à la main ; un tel écart, invisible des
 * migrations, ne serait pas restauré à l'identique.
 *
 * Le miroir `apps/web/src/lib/feature-gates-catalogue.ts` est mis à jour dans
 * le même lot, comme l'exige CONTRIBUTING.md.
 */
const FROZEN_FEATURE_KEYS = [
  'public_api',
  'enterprise_sso',
  'multi_user',
  'cv_analysis',
  'cost_benchmark',
  'eco_materials',
  'site_tracking',
  'quote_reminders',
] as const;

/** Une seule liste pour `up()` et `down()` : leur symétrie ne peut pas dériver. */
const FROZEN_KEYS_SQL = FROZEN_FEATURE_KEYS.map((key) => `'${key}'`).join(', ');

export class FreezeOutOfScopeFeatureGates1711468800065 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "feature_gates" SET "is_enabled" = false WHERE "feature_key" IN (${FROZEN_KEYS_SQL})`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "feature_gates" SET "is_enabled" = true WHERE "feature_key" IN (${FROZEN_KEYS_SQL})`,
    );
  }
}
