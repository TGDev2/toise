import { BadRequestException } from '@nestjs/common';
import type { SubstratePrep } from '../materials/entities/material-catalog.entity';

/**
 * E1-10 — quand un sol demande un ragréage (et son primaire), et quand il n'en
 * demande pas.
 *
 * La règle du métier : les NF DTU 52.2 (carrelage) et 51.11 (parquet flottant)
 * tolèrent un support dont les défauts de planéité ne dépassent pas 5 mm sous
 * la règle de 2 m ; au-delà, un ragréage s'impose. La planéité est un
 * diagnostic que l'artisan fait réellement à la règle sur le chantier — c'est
 * donc une question (`custom_params.floor_flatness`), pas une propriété du
 * produit ni de l'ouvrage.
 *
 * Le primaire n'a pas de question à lui : les fiches de ragréage le
 * prescrivent avant application (PRB PLANIDUR PRO : primaire obligatoire selon
 * support). Il suit donc le ragréage — même déclencheur, même exclusion. Le
 * « primaire seul sur support fermé » (ancien carrelage, sans ragréage) reste
 * hors périmètre : ce diagnostic-là n'a pas de question honnête en V1, c'est
 * écrit dans `docs/MATERIAUX_OUVRAGES.md`.
 *
 * Le défaut est `flat` — même arbitrage, et même garde-fou d'exclusion
 * motivée, que `water_exposure` (`wet-room.ts`) : une pièce non diagnostiquée
 * ne s'achète pas trois sacs de 25 kg, et l'exclusion visible dit à l'artisan
 * que sa réponse a été lue.
 */

/** Clé de la question de planéité dans `work_types.contextual_questions`. */
export const FLOOR_FLATNESS_PARAM = 'floor_flatness';

/**
 * Planéités offertes, **la première étant celle que le moteur retient quand la
 * question n'est pas répondue** — convention E1-6/E1-8.
 */
export const FLOOR_FLATNESS_VALUES = ['flat', 'uneven'] as const;

export type FloorFlatness = (typeof FLOOR_FLATNESS_VALUES)[number];

/** La planéité déclarée n'existe pas. Cf. `UnknownSubfloorTypeError`. */
export class UnknownFloorFlatnessError extends BadRequestException {
  constructor(
    readonly floorFlatness: string,
    readonly offered: readonly string[],
  ) {
    super(
      `Planéité « ${floorFlatness} » inconnue (valeurs offertes : ${offered.join(', ')})`,
    );
    this.name = 'UnknownFloorFlatnessError';
  }
}

/** La planéité déclarée, ou celle que le moteur retient sans réponse. */
export function resolveFloorFlatness(
  customParams: { floor_flatness?: unknown } | null | undefined,
): FloorFlatness {
  const declared = customParams?.[FLOOR_FLATNESS_PARAM];

  if (typeof declared !== 'string' || declared.length === 0) {
    return FLOOR_FLATNESS_VALUES[0];
  }
  if ((FLOOR_FLATNESS_VALUES as readonly string[]).includes(declared)) {
    return declared as FloorFlatness;
  }
  throw new UnknownFloorFlatnessError(declared, FLOOR_FLATNESS_VALUES);
}

/** Le minimum qu'un matériau doit dire pour que cette règle le concerne. */
export interface FloorPrepCandidate {
  id: string;
  name: string;
  substrate_prep?: SubstratePrep | null;
}

export type FloorPrepExclusionReason = 'substrate_declared_flat';

export interface FloorPrepDecision<T extends FloorPrepCandidate> {
  /** Matériaux à chiffrer, dans l'ordre reçu. */
  kept: T[];
  /** Matériaux de préparation écartés, avec leur motif. */
  excluded: {
    material: T;
    reason: FloorPrepExclusionReason;
    reason_fr: string;
  }[];
  /** Motif d'inclusion des matériaux retenus, indexé par identité. */
  inclusionReasonByMaterialId: Map<string, string>;
}

/**
 * Quels matériaux de préparation chiffrer, et pourquoi les autres ne le sont
 * pas. Ne touche qu'aux matériaux marqués `substrate_prep` : tout le reste
 * traverse la fonction inchangé, dans l'ordre reçu.
 */
export function resolveFloorPrep<T extends FloorPrepCandidate>(
  materials: T[],
  customParams: { floor_flatness?: unknown } | null | undefined,
): FloorPrepDecision<T> {
  const marked = materials.filter(
    (m) =>
      m.substrate_prep === 'leveling_compound' ||
      m.substrate_prep === 'leveling_primer',
  );

  if (marked.length === 0) {
    return {
      kept: materials,
      excluded: [],
      inclusionReasonByMaterialId: new Map(),
    };
  }

  const flatness = resolveFloorFlatness(customParams);

  if (flatness === 'uneven') {
    const decision: FloorPrepDecision<T> = {
      kept: materials,
      excluded: [],
      inclusionReasonByMaterialId: new Map(),
    };
    for (const material of marked) {
      decision.inclusionReasonByMaterialId.set(
        material.id,
        `Défauts de planéité déclarés au-delà de 5 mm sous la règle de 2 m : ` +
          `ragréage et primaire nécessaires (NF DTU 52.2 / 51.11).`,
      );
    }
    return decision;
  }

  const reason_fr =
    `Support déclaré plan (défauts ≤ 5 mm sous la règle de 2 m, ` +
    `NF DTU 52.2 / 51.11) : ni ragréage ni primaire nécessaires.`;
  const excluded = marked.map((material) => ({
    material,
    reason: 'substrate_declared_flat' as const,
    reason_fr,
  }));
  const excludedIds = new Set(excluded.map((e) => e.material.id));

  return {
    kept: materials.filter((m) => !excludedIds.has(m.id)),
    excluded,
    inclusionReasonByMaterialId: new Map(),
  };
}
