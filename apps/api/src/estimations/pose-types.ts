import { BadRequestException } from '@nestjs/common';

/**
 * E1-7 — la pose d'un ouvrage, résolue avant de toucher au catalogue.
 *
 * D'où vient ce module. Le moteur écrivait `custom_params.laying_pattern ||
 * 'standard'` et servait cette valeur au catalogue des facteurs de perte. Or
 * `'standard'` n'est pas une pose que le catalogue connaît pour un carreau ou un
 * papier peint : la résolution ne trouvait rien et retombait, en silence, sur un
 * défaut générique de 10 %. Trois ouvrages sur sept ne posant pas la question du
 * calepinage, c'était le chemin **majoritaire**, et le niveau de compétence n'y
 * changeait rien.
 *
 * Ce que ce module tranche : **`standard` n'est pas un repli, c'est le nom de la
 * pose des ouvrages qui n'ont pas de variante de pose** — peinture, cloison
 * sèche, revêtement mural. Les ouvrages qui en ont une (carrelages, parquet) la
 * demandent, et ce qu'ils transmettent est toujours une pose que leurs matériaux
 * déclarent. Il n'existe donc plus aucun ouvrage dont la pose ne corresponde à
 * rien.
 *
 * Le corollaire est dans `estimation-engine.ts` : la résolution n'a plus de
 * troisième temps. Ce qui n'est pas au catalogue lève.
 */

/**
 * Nom de la pose unique — celle des ouvrages sans variante de calepinage.
 *
 * Ce n'est pas « la pose par défaut » : c'est la seule pose que ces ouvrages
 * connaissent. Un matériau qui la déclare ne doit déclarer qu'elle
 * (`waste-factor-coverage.spec.ts`, propriété W1) ; sinon elle redeviendrait le
 * repli silencieux que ce lot supprime.
 */
export const POSE_UNIQUE = 'standard';

/** Clé de la question de calepinage dans `work_types.contextual_questions`. */
export const LAYING_PATTERN_PARAM = 'laying_pattern';

/**
 * Poses qu'un ouvrage peut prendre, **la première étant celle qu'il retient
 * quand la question n'est pas répondue**.
 *
 * L'ordre porte donc du sens, et c'est le même que celui de la question à
 * l'écran : E1-6 avait déjà posé cette convention pour `pattern_repeat_cm`
 * (« la première option est aussi la valeur que retient le moteur en l'absence
 * de réponse : l'écran et le calcul disent la même chose »). E1-7 l'applique au
 * calepinage.
 *
 * C'est une **seconde description des ouvrages** (leçon 15), et elle est traitée
 * comme telle : `pose-types.spec.ts` exige une entrée par ouvrage seedé, et
 * exige qu'elle soit **exactement** la liste des options de sa question
 * `laying_pattern`, dans le même ordre — ou `[POSE_UNIQUE]` s'il n'en pose pas.
 * La table ne peut donc pas diverger de `work-types.data.ts` sans qu'un test le
 * dise.
 *
 * Pourquoi une table et non une lecture de la question. Le moteur ne reçoit que
 * `work_type_code` : il ne porte ni l'entité `WorkType` ni ses questions, et
 * c'est ce qui lui permet de rester une fonction pure du couple (pièce,
 * ouvrage). Lui faire traverser les questions pour lire une valeur par défaut
 * coûterait plus cher que la table qu'un test surveille.
 */
export const POSES_BY_WORK_TYPE: Readonly<Record<string, readonly string[]>> = {
  wall_painting: [POSE_UNIQUE],
  ceiling_painting: [POSE_UNIQUE],
  floor_tiling: ['straight', 'diagonal'],
  wall_tiling: ['straight', 'diagonal'],
  parquet_flooring: ['straight', 'diagonal', 'herringbone'],
  drywall: [POSE_UNIQUE],
  wall_covering: [POSE_UNIQUE],
};

/**
 * La pose transmise n'est pas une pose de cet ouvrage.
 *
 * Distincte de `MissingWasteFactorError` (moteur) à dessein : celle-ci dit
 * « la demande est mal formée », celle-là « le catalogue est incomplet ». Les
 * confondre ferait chercher un trou de données là où un client envoie
 * `herringbone` sur un carrelage — une pose que le parquet propose et que le
 * carrelage n'a jamais offerte, faute de source qui la chiffre.
 *
 * D'où l'héritage de `BadRequestException` : la distinction n'a de valeur que
 * si elle atteint l'appelant. Un 500 dirait « nous avons un problème » là où la
 * vérité est « cette pose n'existe pas pour cet ouvrage », et enverrait chercher
 * le défaut du mauvais côté. `MissingWasteFactorError`, lui, reste une erreur
 * nue : elle **est** un problème de notre côté.
 */
export class UnknownLayingPoseError extends BadRequestException {
  constructor(
    readonly workTypeCode: string,
    readonly poseType: string,
    readonly offered: readonly string[],
  ) {
    super(
      `Pose « ${poseType} » inconnue de l'ouvrage ${workTypeCode} ` +
        `(poses offertes : ${offered.join(', ')})`,
    );
    this.name = 'UnknownLayingPoseError';
  }
}

/**
 * Pose à servir au catalogue pour cet ouvrage.
 *
 * Trois cas, et aucun repli muet :
 *
 * 1. rien de déclaré → la pose par défaut de l'ouvrage, qui est **une vraie
 *    pose** de son catalogue et non le mot `standard` ;
 * 2. une pose que l'ouvrage offre → elle ;
 * 3. une pose qu'il n'offre pas, **alors qu'il a plusieurs poses** →
 *    `UnknownLayingPoseError`. Chiffrer des chevrons « comme une pose droite »
 *    serait rendre un prix pour un chantier qui n'est pas celui qu'on a décrit.
 *
 * Le cas 3 est volontairement **restreint aux ouvrages à variantes**. Un client
 * d'API qui envoie `laying_pattern: 'straight'` sur une peinture décrit un
 * chantier bancal, mais il n'existe qu'un seul prix possible pour lui : la
 * peinture n'a pas de variante de pose. Lever ici transformerait une demande
 * inoffensive, et acceptée jusqu'ici, en erreur 500 — sans protéger d'aucun
 * chiffrage faux, puisqu'il n'y a pas deux chiffrages à confondre. On ne lève
 * que là où le silence coûterait une quantité fausse.
 *
 * Un ouvrage inconnu de la table — un 8e ouvrage créé en base sans passer par le
 * seed — est traité comme un ouvrage sans variante de pose. C'est le sens sûr :
 * il fonctionne sans que personne ait rien à déclarer si ses matériaux n'ont pas
 * de variante, et il **lève** à la résolution, avec le nom du matériau, s'ils en
 * ont une. L'oubli est silencieux là où il est sans conséquence, et bruyant là
 * où il en a une (leçon 5).
 */
export function resolveLayingPose(
  workTypeCode: string,
  // Volontairement décrit par le seul champ lu, et non par
  // `Record<string, unknown>` : le DTO public est une classe, qui n'a pas de
  // signature d'index et ne s'y assignerait pas. Les deux appelants — le moteur
  // et le vérificateur de devis — passent ainsi le même objet sans conversion.
  customParams: { laying_pattern?: unknown } | null | undefined,
): string {
  const offered = POSES_BY_WORK_TYPE[workTypeCode] ?? [POSE_UNIQUE];
  const declared = customParams?.[LAYING_PATTERN_PARAM];

  if (typeof declared !== 'string' || declared.length === 0) {
    return offered[0];
  }
  if (offered.includes(declared)) {
    return declared;
  }
  if (offered.length > 1) {
    throw new UnknownLayingPoseError(workTypeCode, declared, offered);
  }
  return offered[0];
}
