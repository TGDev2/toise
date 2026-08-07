import { BadRequestException } from '@nestjs/common';
import type { WetRoomRole } from '../materials/entities/material-catalog.entity';

/**
 * E1-10 — quand un carrelage demande un Système d'Étanchéité Liquide, et quand
 * il n'en demande pas.
 *
 * La règle du métier : le NF DTU 52.2 impose une protection à l'eau sous
 * carrelage dans les locaux très exposés (zones de douche, locaux EB+) ; dans
 * un séjour ou une cuisine, le SEL est un bidon acheté pour rien. La condition
 * n'est pas une propriété du produit ni de l'ouvrage : c'est l'exposition à
 * l'eau du local, et seul l'utilisateur la connaît — d'où une question
 * (`work_types.contextual_questions`), comme `subfloor_type` (E1-8).
 *
 * **Le défaut inverse la doctrine d'E1-8, et c'est une décision assumée.**
 * Pour le pare-vapeur, « défaut = sens sûr » coûtait un rouleau sur les seuls
 * parquets ; ici, « sûr = exposé » achèterait un SEL complet (bidon + bande)
 * sur **tous** les carrelages non répondus — chaque séjour, chaque cuisine du
 * chemin public. Le défaut est donc `dry`, et le garde-fou est l'exclusion
 * motivée : en local sec, la ligne SEL sort en exclusion **visible**, dans les
 * deux sens l'artisan voit que sa réponse a été lue. Arbitrage utilisateur du
 * 2026-08-08, consigné dans `docs/SOURCES_CATALOGUE.md`.
 *
 * Simplification V1, écrite au registre : l'assiette du SEL est la surface
 * d'ouvrage **entière**, alors que le DTU ne l'exige que sur la zone exposée.
 * Les exclusions de zone (ENG-3) permettent déjà de réduire l'assiette à la
 * zone de douche ; le sens de l'écart résiduel est le sens sûr (trop de SEL,
 * jamais trop peu).
 */

/** Clé de la question d'exposition dans `work_types.contextual_questions`. */
export const WATER_EXPOSURE_PARAM = 'water_exposure';

/**
 * Expositions offertes, **la première étant celle que le moteur retient quand
 * la question n'est pas répondue** — la convention d'E1-6/E1-8 : l'écran et le
 * calcul disent la même chose.
 */
export const WATER_EXPOSURES = ['dry', 'wet_room'] as const;

export type WaterExposure = (typeof WATER_EXPOSURES)[number];

/** Libellés français des expositions, pour les raisons rendues à l'écran. */
const WATER_EXPOSURE_LABELS: Record<WaterExposure, string> = {
  dry: 'sec',
  wet_room: "salle d'eau",
};

/**
 * L'exposition déclarée n'existe pas. Même raison que
 * `UnknownSubfloorTypeError` : chiffrer « comme un local sec » un local décrit
 * par un mot inconnu serait rendre un prix pour un autre chantier.
 */
export class UnknownWaterExposureError extends BadRequestException {
  constructor(
    readonly waterExposure: string,
    readonly offered: readonly string[],
  ) {
    super(
      `Exposition à l'eau « ${waterExposure} » inconnue (valeurs offertes : ${offered.join(', ')})`,
    );
    this.name = 'UnknownWaterExposureError';
  }
}

/** L'exposition déclarée, ou celle que le moteur retient sans réponse. */
export function resolveWaterExposure(
  customParams: { water_exposure?: unknown } | null | undefined,
): WaterExposure {
  const declared = customParams?.[WATER_EXPOSURE_PARAM];

  if (typeof declared !== 'string' || declared.length === 0) {
    return WATER_EXPOSURES[0];
  }
  if ((WATER_EXPOSURES as readonly string[]).includes(declared)) {
    return declared as WaterExposure;
  }
  throw new UnknownWaterExposureError(declared, WATER_EXPOSURES);
}

/** Le minimum qu'un matériau doit dire pour que cette règle le concerne. */
export interface WetRoomCandidate {
  id: string;
  name: string;
  wet_room_system?: WetRoomRole | null;
}

export type WetRoomExclusionReason = 'room_not_wet';

export interface WetRoomDecision<T extends WetRoomCandidate> {
  /** Matériaux à chiffrer, dans l'ordre reçu. */
  kept: T[];
  /** Matériaux d'étanchéité écartés, avec leur motif. */
  excluded: {
    material: T;
    reason: WetRoomExclusionReason;
    reason_fr: string;
  }[];
  /** Motif d'inclusion des matériaux retenus, indexé par identité. */
  inclusionReasonByMaterialId: Map<string, string>;
}

/**
 * Quels matériaux d'étanchéité chiffrer, et pourquoi les autres ne le sont
 * pas. Ne touche qu'aux matériaux marqués `wet_room_system` : tout le reste
 * traverse la fonction inchangé, dans l'ordre reçu — aucune condition sur
 * `work_type_code` n'est nécessaire.
 */
export function resolveWetRoom<T extends WetRoomCandidate>(
  materials: T[],
  customParams: { water_exposure?: unknown } | null | undefined,
): WetRoomDecision<T> {
  const marked = materials.filter(
    (m) => m.wet_room_system === 'sel' || m.wet_room_system === 'sealing_band',
  );

  if (marked.length === 0) {
    return {
      kept: materials,
      excluded: [],
      inclusionReasonByMaterialId: new Map(),
    };
  }

  const exposure = resolveWaterExposure(customParams);

  if (exposure === 'wet_room') {
    const decision: WetRoomDecision<T> = {
      kept: materials,
      excluded: [],
      inclusionReasonByMaterialId: new Map(),
    };
    for (const material of marked) {
      decision.inclusionReasonByMaterialId.set(
        material.id,
        `Local déclaré salle d'eau : protection à l'eau sous carrelage ` +
          `requise (SEL, NF DTU 52.2).`,
      );
    }
    return decision;
  }

  const reason_fr =
    `Local déclaré ${WATER_EXPOSURE_LABELS[exposure]} : aucun système ` +
    `d'étanchéité liquide requis (SEL réservé aux salles d'eau, NF DTU 52.2).`;
  const excluded = marked.map((material) => ({
    material,
    reason: 'room_not_wet' as const,
    reason_fr,
  }));
  const excludedIds = new Set(excluded.map((e) => e.material.id));

  return {
    kept: materials.filter((m) => !excludedIds.has(m.id)),
    excluded,
    inclusionReasonByMaterialId: new Map(),
  };
}
