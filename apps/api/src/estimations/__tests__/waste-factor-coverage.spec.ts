import { resolveWasteFactor } from '../estimation-engine';
import { POSE_UNIQUE } from '../pose-types';
import { seedMaterials } from '../../materials/seed-catalog.data';
import { seedWorkTypes, SeedWorkType } from '../../projects/work-types.data';
import { materialsForWorkType, SKILL_LEVELS } from './seeded-catalog-harness';

/**
 * E1-7 — le registre des pertes n'a plus de trou, et ne peut plus en cacher un.
 *
 * Ce fichier est le garde-fou que l'énoncé d'E1-7 réclame : « faire échouer la
 * résolution de façon bruyante plutôt que retomber sur une valeur par défaut ».
 * L'exception `MissingWasteFactorError` couvre l'exécution ; ces tests couvrent
 * les **données**, c'est-à-dire le seul endroit où le trou pouvait naître.
 *
 * Pourquoi le défaut avait survécu. `resolveWasteFactor` résolvait en trois
 * temps — pose exacte, puis pose `standard`, puis 10 % génériques — et les deux
 * derniers temps étaient **silencieux**. Trois ouvrages sur sept ne posant pas la
 * question du calepinage, la pose transmise valait `standard`, qu'aucun carreau
 * ni aucun papier peint ne déclarait : 24 des 111 lignes de matériau de chaque
 * géométrie du harnais étaient chiffrées à 10 %, quel que soit le niveau de
 * compétence. Le curseur vendu sur la page de vente ne faisait rien.
 *
 * Les trois propriétés ci-dessous sont écrites sur les **données seedées**, pas
 * sur un fixture : elles échouent le jour où quelqu'un ajoute une pose, un
 * matériau ou un ouvrage sans compléter le registre — c'est-à-dire exactement le
 * jour où le défaut d'origine se rejouerait.
 */

/** Le nom que porte, dans le catalogue, la pose des ouvrages sans variante. */
const LAYING_PATTERN_KEY = 'laying_pattern';

/**
 * Poses qu'un ouvrage peut réellement transmettre au moteur.
 *
 * Dérivé de la **question** et non du catalogue : c'est l'écran qui décide de ce
 * qu'un utilisateur peut répondre. Un ouvrage sans question de calepinage ne
 * transmet jamais qu'une pose, celle des ouvrages sans variante.
 */
function posesEmittedBy(workType: SeedWorkType): string[] {
  const question = workType.contextual_questions.find(
    (q) => q.key === LAYING_PATTERN_KEY,
  );
  if (!question) {
    return [POSE_UNIQUE];
  }
  return (question.options ?? []).map((o) => o.value);
}

const declaredPoses = (wasteFactors: { pose_type: string }[]): string[] => [
  ...new Set(wasteFactors.map((wf) => wf.pose_type)),
];

const isPoseSensitive = (wasteFactors: { pose_type: string }[]): boolean =>
  declaredPoses(wasteFactors).some((pose) => pose !== POSE_UNIQUE);

describe('Facteurs de perte — couverture du registre', () => {
  /**
   * [W1] Le vocabulaire est sans ambiguïté.
   *
   * C'est cette propriété qui rend le second temps de la résolution incapable de
   * masquer un trou : il ne peut servir qu'un matériau qui n'a **aucune** pose
   * variante. Un matériau qui déclarerait `standard` *et* `diagonal` ferait de
   * `standard` un repli déguisé pour les poses qu'il a oublié de renseigner —
   * exactement ce que faisait `floorWaste()` avant ce lot.
   */
  it('[W1] aucun matériau ne mélange la pose unique et une pose variante', () => {
    const mixed = seedMaterials
      .filter(
        (mat) =>
          declaredPoses(mat.waste_factors).includes(POSE_UNIQUE) &&
          isPoseSensitive(mat.waste_factors),
      )
      .map(
        (mat) =>
          `${mat.category}/${mat.name} — ${declaredPoses(mat.waste_factors).sort().join(', ')}`,
      );

    expect(mixed).toEqual([]);
  });

  /**
   * [W2] Un ouvrage dont un matériau distingue les poses **demande** la pose.
   *
   * Sans cette propriété, la donnée existe et reste inatteignable : avant ce lot,
   * `wall_tiling` seedait `straight` et `diagonal` sur ses trois matériaux et ne
   * posait aucune question — la pose diagonale n'était accessible par aucun
   * chemin utilisateur, et la pose transmise ne correspondait à rien.
   */
  it('[W2] tout ouvrage à matériau sensible à la pose demande le calepinage', () => {
    const violations: string[] = [];

    for (const workType of seedWorkTypes) {
      const materials = materialsForWorkType(workType.code);
      const variantPoses = [
        ...new Set(
          materials
            .filter((mat) => isPoseSensitive(mat.waste_factors))
            .flatMap((mat) => declaredPoses(mat.waste_factors)),
        ),
      ].sort();

      const emitted = posesEmittedBy(workType).slice().sort();

      if (variantPoses.length === 0) {
        if (emitted.join() !== POSE_UNIQUE) {
          violations.push(
            `${workType.code} : aucune pose variante au catalogue, mais l'écran propose ${emitted.join(', ')}`,
          );
        }
        continue;
      }

      if (variantPoses.join() !== emitted.join()) {
        violations.push(
          `${workType.code} : catalogue ${variantPoses.join(', ')} / écran ${emitted.join(', ')}`,
        );
      }
    }

    expect(violations).toEqual([]);
  });

  /**
   * [W3] Le registre est complet : ouvrage × pose × niveau, sur **chaque**
   * matériau lié.
   *
   * L'assertion porte sur `source`, la seule chose que le moteur rapporte de son
   * chemin de résolution. `'default'` y est désormais impossible — la fonction
   * lève — mais l'assertion reste écrite : un futur repli réintroduit se
   * signalerait ici avant de se signaler en production.
   */
  it('[W3] aucune combinaison ouvrage × pose × niveau ne manque au catalogue', () => {
    const violations: string[] = [];
    let resolved = 0;

    for (const workType of seedWorkTypes) {
      for (const poseType of posesEmittedBy(workType)) {
        for (const skillLevel of SKILL_LEVELS) {
          for (const material of materialsForWorkType(workType.code)) {
            try {
              const factor = resolveWasteFactor(
                material.waste_factors,
                poseType,
                skillLevel,
              );
              resolved += 1;
              if (factor.source !== 'catalog') {
                violations.push(
                  `${workType.code} · ${poseType} · ${skillLevel} · ${material.name} — origine ${factor.source}`,
                );
              }
            } catch (error) {
              violations.push(
                `${workType.code} · ${poseType} · ${skillLevel} · ${material.name} — ${(error as Error).message}`,
              );
            }
          }
        }
      }
    }

    expect(violations).toEqual([]);
    /*
     * Un test de couverture qui n'a rien parcouru est vert et inutile : le
     * compte est la preuve qu'il a travaillé (cf. le filtre mort d'E1-3 que
     * `harness-coverage.spec.ts` documente). Il est écrit en clair, et se
     * recalcule à la main — poses × niveaux × matériaux liés obligatoires,
     * matériaux conditionnels d'E1-10 compris (SEL, bande, ragréages,
     * primaires : la question décide de la ligne, pas de la présence au
     * registre des pertes) :
     *
     *   wall_painting      1 × 3 ×  2 =  6
     *   ceiling_painting   1 × 3 ×  2 =  6
     *   floor_tiling       2 × 3 × 11 = 66
     *   wall_tiling        2 × 3 ×  5 = 30
     *   parquet_flooring   3 × 3 ×  7 = 63
     *   drywall            1 × 3 ×  8 = 24
     *   wall_covering      1 × 3 ×  2 =  6
     *                                  ---
     *                                  201
     */
    expect(resolved).toBe(201);
  });
});
