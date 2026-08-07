import { BadRequestException } from '@nestjs/common';
import type { VapourBarrierRole } from '../materials/entities/material-catalog.entity';

/**
 * E1-8 — quand un sol posé en flottant demande un film pare-vapeur, et quand il
 * n'en demande pas.
 *
 * D'où vient ce module. `Film pare-vapeur PE` était lié au parquet en
 * `is_optional: false` : il était donc acheté sur **tous** les chantiers, à
 * 1,25 m² par m² de sol pour tenir compte du recouvrement de 20 cm. Le ratio
 * était juste ; le déclenchement était faux.
 *
 * La règle du métier, telle que le NF DTU 51.11 l'écrit : « Dans le cas de
 * supports à base de liants hydrauliques ou de supports minéraux ou dans le cas
 * de l'utilisation d'un plancher chauffant, un film pare-vapeur doit être mis en
 * œuvre. » Un plancher bois ne dégage pas d'humidité par capillarité, et un
 * ancien revêtement fait déjà écran — dans les deux cas le film est un rouleau
 * acheté pour rien.
 *
 * S'y ajoute une condition que le DTU ne dit pas mais que tout emballage de
 * sous-couche dit : **une sous-couche à pare-vapeur intégré rend le film nu
 * inutile.** Poser les deux, c'est enfermer de l'humidité entre deux films.
 *
 * Deux informations, donc, et elles vivent chacune là où elles décrivent
 * quelque chose de vrai : la nature du support est une réponse de l'utilisateur
 * (`work_types.contextual_questions`), la présence d'un pare-vapeur intégré est
 * une propriété du produit (`materials_catalog.vapour_barrier`). Ni l'une ni
 * l'autre n'est déduite d'un code d'ouvrage — c'est la même discipline que
 * `quantity_driver` (E1-3) et `consumption_model` (E1-5).
 *
 * **Réserve consignée, non traitée par ce lot** : le DTU fait du plancher
 * chauffant un troisième déclencheur, indépendant du support. Le produit ne pose
 * la question nulle part — ni au parquet, ni au carrelage, ni à la peinture — et
 * l'ajouter dépasserait la demande. Le sens de l'écart n'est pas sûr ici : sur
 * un plancher chauffant posé sur plancher bois, ce module conclura « pas de film
 * nécessaire » alors que le DTU en exige un. C'est écrit au registre
 * (`docs/SOURCES_CATALOGUE.md`) pour ne pas être redécouvert.
 */

/** Clé de la question de support dans `work_types.contextual_questions`. */
export const SUBFLOOR_PARAM = 'subfloor_type';

/**
 * Supports offerts, **le premier étant celui que le moteur retient quand la
 * question n'est pas répondue**.
 *
 * L'ordre porte du sens, et c'est la convention posée par E1-6 pour
 * `pattern_repeat_cm` puis reprise par E1-7 pour le calepinage : « la première
 * option est aussi la valeur que retient le moteur en l'absence de réponse —
 * l'écran et le calcul disent la même chose ». Ici elle porte en plus le sens
 * sûr : sans réponse, on suppose le support qui **exige** le film.
 */
export const SUBFLOOR_TYPES = [
  'concrete_screed',
  'wood_floor',
  'existing_covering',
] as const;

export type SubfloorType = (typeof SUBFLOOR_TYPES)[number];

/** Libellés français des supports, pour les raisons rendues à l'utilisateur. */
const SUBFLOOR_LABELS: Record<SubfloorType, string> = {
  concrete_screed: 'béton ou chape',
  wood_floor: 'plancher bois',
  existing_covering: 'ancien revêtement',
};

/**
 * Supports qui exigent un pare-vapeur. Un ensemble et non un booléen en dur :
 * ajouter un support minéral (dalle sèche, chape fluide anhydrite) est alors
 * une ligne de donnée, pas une condition de plus dans le code.
 */
const SUBFLOORS_REQUIRING_BARRIER: ReadonlySet<SubfloorType> = new Set([
  'concrete_screed',
]);

/**
 * Le support déclaré n'existe pas.
 *
 * `BadRequestException` pour la même raison qu'`UnknownLayingPoseError`
 * (`pose-types.ts`) : la distinction n'a de valeur que si elle atteint
 * l'appelant. Un client d'API qui envoie `subfloor_type: 'terre battue'` décrit
 * un chantier que nous ne savons pas chiffrer ; le chiffrer « comme du béton »
 * serait rendre un prix pour un autre chantier que celui qu'on a décrit.
 */
export class UnknownSubfloorTypeError extends BadRequestException {
  constructor(
    readonly subfloorType: string,
    readonly offered: readonly string[],
  ) {
    super(
      `Support « ${subfloorType} » inconnu (supports offerts : ${offered.join(', ')})`,
    );
    this.name = 'UnknownSubfloorTypeError';
  }
}

/** Le support déclaré, ou celui que le moteur retient sans réponse. */
export function resolveSubfloorType(
  // Volontairement décrit par le seul champ lu, comme `resolveLayingPose` : le
  // DTO public est une classe, sans signature d'index, et ne s'assignerait pas
  // à `Record<string, unknown>`.
  customParams: { subfloor_type?: unknown } | null | undefined,
): SubfloorType {
  const declared = customParams?.[SUBFLOOR_PARAM];

  if (typeof declared !== 'string' || declared.length === 0) {
    return SUBFLOOR_TYPES[0];
  }
  if ((SUBFLOOR_TYPES as readonly string[]).includes(declared)) {
    return declared as SubfloorType;
  }
  throw new UnknownSubfloorTypeError(declared, SUBFLOOR_TYPES);
}

/** Ce support exige-t-il un film pare-vapeur ? */
export function subfloorRequiresVapourBarrier(
  customParams: { subfloor_type?: unknown } | null | undefined,
): boolean {
  return SUBFLOORS_REQUIRING_BARRIER.has(resolveSubfloorType(customParams));
}

/** Le minimum qu'un matériau doit dire pour que cette règle le concerne. */
export interface VapourBarrierCandidate {
  id: string;
  name: string;
  vapour_barrier?: VapourBarrierRole | null;
}

/**
 * Pourquoi un film dédié a été écarté. Codé **et** rédigé : le code sert aux
 * tests et à un éventuel filtrage, la phrase va à l'écran. Traduire le code en
 * français côté web dupliquerait la règle dans une seconde langue de programme.
 */
export type VapourBarrierExclusionReason =
  | 'subfloor_does_not_require'
  | 'underlay_integrates';

export interface VapourBarrierDecision<T extends VapourBarrierCandidate> {
  /** Matériaux à chiffrer, dans l'ordre reçu. */
  kept: T[];
  /** Films écartés, avec leur motif. */
  excluded: {
    material: T;
    reason: VapourBarrierExclusionReason;
    reason_fr: string;
  }[];
  /**
   * Motif d'**inclusion** du film retenu, indexé par identité de matériau. Vide
   * quand aucun film n'est retenu. La ligne qui apparaît doit dire pourquoi
   * autant que celle qui disparaît : sans cela, l'artisan ne peut vérifier que
   * la réponse qu'il a donnée a bien été lue.
   */
  inclusionReasonByMaterialId: Map<string, string>;
}

/**
 * Quels matériaux chiffrer, et pourquoi les autres ne le sont pas.
 *
 * Ne touche qu'aux matériaux `dedicated` : tout le reste traverse la fonction
 * inchangé, dans l'ordre reçu. Un ouvrage sans film dédié — c'est-à-dire les six
 * autres ouvrages seedés — ne voit donc littéralement rien changer, et aucune
 * condition sur `work_type_code` n'est nécessaire pour cela.
 */
export function resolveVapourBarrier<T extends VapourBarrierCandidate>(
  materials: T[],
  customParams: { subfloor_type?: unknown } | null | undefined,
): VapourBarrierDecision<T> {
  const dedicated = materials.filter((m) => m.vapour_barrier === 'dedicated');

  if (dedicated.length === 0) {
    return {
      kept: materials,
      excluded: [],
      inclusionReasonByMaterialId: new Map(),
    };
  }

  const subfloor = resolveSubfloorType(customParams);
  const integrating = materials.find((m) => m.vapour_barrier === 'integrated');
  const required = SUBFLOORS_REQUIRING_BARRIER.has(subfloor);

  const decision: VapourBarrierDecision<T> = {
    kept: materials,
    excluded: [],
    inclusionReasonByMaterialId: new Map(),
  };

  // L'ordre des deux motifs n'est pas indifférent : sur béton avec une
  // sous-couche à pare-vapeur intégré, c'est la sous-couche qu'il faut nommer,
  // pas le support — le support, lui, exige bien un pare-vapeur, et il en a un.
  if (!required) {
    const reason_fr =
      `Support ${SUBFLOOR_LABELS[subfloor]} : aucun pare-vapeur nécessaire ` +
      `(NF DTU 51.11, exigé sur support minéral).`;
    decision.excluded = dedicated.map((material) => ({
      material,
      reason: 'subfloor_does_not_require' as const,
      reason_fr,
    }));
  } else if (integrating) {
    const reason_fr =
      `La sous-couche « ${integrating.name} » intègre déjà un pare-vapeur : ` +
      `un second film enfermerait l'humidité entre les deux.`;
    decision.excluded = dedicated.map((material) => ({
      material,
      reason: 'underlay_integrates' as const,
      reason_fr,
    }));
  } else {
    for (const material of dedicated) {
      decision.inclusionReasonByMaterialId.set(
        material.id,
        `Support ${SUBFLOOR_LABELS[subfloor]} et sous-couche sans pare-vapeur ` +
          `intégré : le film est nécessaire (NF DTU 51.11).`,
      );
    }
    return decision;
  }

  const excludedIds = new Set(decision.excluded.map((e) => e.material.id));
  decision.kept = materials.filter((m) => !excludedIds.has(m.id));
  return decision;
}
