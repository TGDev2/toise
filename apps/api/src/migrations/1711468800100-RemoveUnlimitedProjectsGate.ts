import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * BACKLOG_V1 E3-2 (ADR 0002 D4) — le chiffrage devient gratuit et **illimité**.
 *
 * `unlimited_projects` disparaît parce qu'elle décrit l'inverse de ce qu'une
 * gate sait faire. Une gate **accorde** une capacité à partir d'un palier ;
 * l'illimité est l'**absence d'un quota**. Tant que la promesse restait adossée
 * à cette ligne, elle héritait du caractère fail-closed du mécanisme
 * (`FeatureGatesService.isFeatureAllowed` : ligne absente → refus, `is_enabled`
 * à `false` → refus) : supprimer la ligne, la geler ou remonter son palier
 * réimposait **deux projets actifs** à tous les comptes gratuits, sans un mot et
 * sans qu'aucun test puisse le voir. Le cœur de l'offre gratuite ne peut pas
 * dépendre d'un réglage d'administration dont l'oubli ferme.
 *
 * Le quota qu'elle levait est retiré du code dans le même lot
 * (`ProjectsService.FREE_TIER_PROJECT_LIMIT` et la fenêtre d'écriture
 * `is_read_only` qu'il pilotait). Après ce lot, plus rien ne lit cette gate :
 * la laisser en base serait garder une ligne que personne ne consulte, dont le
 * prochain lecteur croirait qu'elle protège quelque chose.
 *
 * **Le plafond invité n'est pas touché.** `GUEST_PROJECT_LIMIT = 1` est déjà
 * indépendant de cette gate (`if (isGuest || !unlimitedAllowed)`) : un compte
 * anonyme reste borné à un projet, et c'est la seule limite de volume que le
 * lot conserve.
 *
 * `down()` réinsère la ligne **dans l'état où elle est au moment de la
 * suppression** — `free` / `is_enabled` — et non dans son état d'origine
 * (`'pro'`, migration …017), palier retiré par …099 : une réversion doit rendre
 * un schéma exploitable, pas ressusciter un palier que plus aucune offre ne
 * porte.
 *
 * Le miroir `apps/web/src/lib/feature-gates-catalogue.ts` est mis à jour dans le
 * même lot, comme l'exige CONTRIBUTING.md.
 */
const GATE_KEY = 'unlimited_projects';
const GATE_LABEL = 'Projets illimités';
const GATE_DESCRIPTION = 'Créez autant de projets que nécessaire';
const GATE_TIER = 'free';

export class RemoveUnlimitedProjectsGate1711468800100 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "feature_gates" WHERE "feature_key" = $1`,
      [GATE_KEY],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "feature_gates" ("feature_key", "label_fr", "description_fr", "min_tier", "is_enabled")
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT ("feature_key") DO NOTHING`,
      [GATE_KEY, GATE_LABEL, GATE_DESCRIPTION, GATE_TIER],
    );
  }
}
