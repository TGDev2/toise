import { POSES_BY_WORK_TYPE, POSE_UNIQUE } from '../estimations/pose-types';

/**
 * E2-2 — résolution d'un temps de pose du registre E2-1.
 *
 * Fonction pure sur un tableau de lignes, comme `resolveWasteFactor`
 * (`estimations/estimation-engine.ts`) : le devis et le spec du registre
 * doivent résoudre **la même** valeur, et deux implémentations divergeraient en
 * silence. Aucun dépôt, aucun service — ce qui la rend éprouvable contre
 * `seedLaborTimes` lui-même plutôt que contre des lignes composées à la main
 * (leçon 32).
 *
 * Le contrat n'est pas inventé ici : il est écrit dans
 * `projects/labor-times.data.ts` et dans `docs/SOURCES_CATALOGUE.md` depuis
 * E2-1. Cette fonction l'implémente, elle ne le décide pas.
 */

/**
 * Ce que la résolution lit d'une ligne du registre — et rien de plus.
 *
 * Volontairement une interface et non l'entité `LaborTime` : le spec du
 * registre alimente la fonction avec `seedLaborTimes`, dont le `skill_level`
 * est **absent** là où la base porte `NULL`. Les deux formes sont acceptées et
 * normalisées ici, à un seul endroit.
 */
export interface LaborTimeInput {
  work_type_code: string;
  pose_type: string;
  skill_level?: string | null;
  unit_basis: string;
  hours_per_unit: number;
}

/**
 * Une ligne du registre telle que la base la rend, code d'ouvrage résolu.
 *
 * Porte la source parce que le consommateur en a besoin pour dire d'où sort le
 * chiffre — c'est toute la raison d'être d'E2-1. Elle n'est jamais persistée
 * sur le devis : voir `QuoteLaborLine` (`quotes/entities/quote.entity.ts`).
 */
export interface LaborTimeRow extends LaborTimeInput {
  skill_level: string | null;
  hours_low: number | null;
  hours_high: number | null;
  source_org: string;
  source_document: string;
  source_url: string;
}

/**
 * Pose retenue quand l'ouvrage n'est pas dans `POSES_BY_WORK_TYPE` — un 8e
 * ouvrage créé en base sans passer par le seed. Même parti que
 * `resolveLayingPose` : traité comme un ouvrage sans variante de pose, ce qui
 * est le sens sûr.
 */
function basePoseOf(workTypeCode: string): string {
  return (POSES_BY_WORK_TYPE[workTypeCode] ?? [POSE_UNIQUE])[0];
}

/**
 * Le temps unitaire à retenir pour cet ouvrage, cette pose et ce niveau.
 *
 * Trois temps, dans cet ordre, exactement ceux du contrat d'E2-1 :
 *
 * 1. la ligne exacte `(pose, niveau)` ;
 * 2. sinon la ligne `(pose, tous niveaux)` ;
 * 3. sinon la ligne de base `(pose par défaut de l'ouvrage, tous niveaux)`,
 *    dont `labor-sources-catalogue.spec.ts` garantit l'existence pour chaque
 *    ouvrage seedé.
 *
 * Conséquence assumée et documentée : `intermediate` et `expert` retombent sur
 * la ligne « tous niveaux », qui est un temps de professionnel confirmé — c'est
 * ce que publient les sources libres. Aucune source ne chiffrant le niveau
 * `expert`, lui fabriquer un coefficient serait inventer la donnée que tout
 * E2-1 s'est interdit d'inventer.
 *
 * Renvoie `null` seulement si l'ouvrage n'a **aucune** ligne au registre — un
 * ouvrage ajouté sans son temps de pose. L'appelant ne doit alors rien
 * proposer, surtout pas une valeur de repli : c'est le trou de données qu'il
 * faut voir, pas masquer.
 */
export function resolveLaborTime<T extends LaborTimeInput>(
  laborTimes: readonly T[],
  workTypeCode: string,
  poseType: string,
  skillLevel: string | null | undefined,
): T | null {
  const forWorkType = laborTimes.filter(
    (lt) => lt.work_type_code === workTypeCode,
  );
  if (forWorkType.length === 0) return null;

  const level = skillLevel ?? null;
  const allLevels = (lt: T) => (lt.skill_level ?? null) === null;

  if (level !== null) {
    const exact = forWorkType.find(
      (lt) => lt.pose_type === poseType && (lt.skill_level ?? null) === level,
    );
    if (exact) return exact;
  }

  const samePose = forWorkType.find(
    (lt) => lt.pose_type === poseType && allLevels(lt),
  );
  if (samePose) return samePose;

  const basePose = basePoseOf(workTypeCode);
  return (
    forWorkType.find((lt) => lt.pose_type === basePose && allLevels(lt)) ?? null
  );
}
