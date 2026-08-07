import {
  EstimationEngine,
  PackagingInput,
  ResolvedWasteFactor,
  SelectedPackaging,
  WasteFactorInput,
} from '../estimation-engine';
import { consumptionBoundByMaterialKey } from '../../materials/consumption-bounds.data';
import { SkillLevel } from '../../projects/entities/project-work-item.entity';
import {
  caseFor,
  HarnessCase,
  POSE_UNIQUE_CASE,
  invariantViolations,
  RECTANGULAR_ROOM,
} from './seeded-catalog-harness';

/**
 * Ce que les sept invariants attrapent réellement.
 *
 * Un garde-fou qu'on n'a jamais vu échouer ne garde rien : c'est la maladie que
 * ce harnais existe pour soigner, et il n'en est pas exempt. Le dépôt en a déjà
 * donné l'exemple — `estimation-engine.seeded-catalog.spec.ts` filtrait les
 * accessoires sur une expression qui ne correspondait à aucun matériau lié, et
 * se réduisait à `expect([]).toEqual([])`, vert et vide.
 *
 * Chaque cas ci-dessous **remet un défaut réel** dans le moteur, par
 * substitution d'une seule méthode, et exige que l'invariant correspondant le
 * nomme. Les défauts ne sont pas inventés : ce sont ceux qu'E1-4, E1-5 et E1-7
 * ont corrigés, et celui que DATA-3 peut réintroduire.
 */

const ROOM = RECTANGULAR_ROOM;
const engine = new EstimationEngine();

const smallestOf = (packagings: PackagingInput[]): PackagingInput =>
  [...packagings].sort((a, b) => a.quantity_per_unit - b.quantity_per_unit)[0];

const singleFormat = (
  format: PackagingInput,
  units: number,
): SelectedPackaging => ({
  label: format.label,
  qty_per_unit: format.quantity_per_unit,
  units_needed: units,
  breakdown: units > 0 ? [{ label: format.label, units }] : [],
});

const violationsOf = (prefix: string, broken: EstimationEngine): string[] =>
  invariantViolations(broken, ROOM).filter((v) => v.startsWith(prefix));

describe('Harnais — ce que les invariants attrapent', () => {
  /**
   * I1 — sous-achat. Le défaut se rejoue en tronquant le besoin au lieu de
   * l'arrondir au contenant supérieur : c'est ce que produirait un
   * `STEP_EPSILON` trop généreux dans `solvePackagingMix`.
   */
  it('I1 nomme le matériau sous-acheté et les deux quantités', () => {
    class UnderBuying extends EstimationEngine {
      selectBestPackaging(
        adjustedQty: number,
        packagings: PackagingInput[],
      ): SelectedPackaging {
        const format = smallestOf(packagings);
        return singleFormat(
          format,
          Math.floor(adjustedQty / format.quantity_per_unit),
        );
      }
    }

    const violations = violationsOf('[I1]', new UnderBuying());

    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toMatch(
      /^\[I1\] wall_painting · beginner · standard : Peinture acrylique mate — \d+\.\d{3} L achetés pour \d+\.\d{3} L nécessaires$/,
    );
  });

  /**
   * I2 — le défaut d'E1-4, tel quel : les couches appliquées à tout matériau,
   * accessoires et sous-couches compris. C'est lui qui commandait 70 pinceaux
   * et 3 pots de peinture plafond pour une peinture murale.
   */
  it('I2 nomme le matériau insensible aux couches et les deux quantités', () => {
    class CoatsOnEverything extends EstimationEngine {
      computeTheoreticalQty(
        surfaceM2: number,
        yieldPerUnit: number,
        customParams: Record<string, unknown>,
      ): { qty: number; coats?: number } {
        return super.computeTheoreticalQty(
          surfaceM2,
          yieldPerUnit,
          customParams,
          true,
        );
      }
    }

    const violations = violationsOf('[I2]', new CoatsOnEverything());

    expect(violations).toContain(
      '[I2] wall_painting · beginner · standard : Sous-couche universelle (applies_coats faux) — ' +
        '3.830 L à 1 couche(s) contre 11.491 L à 3 couche(s)',
    );
  });

  /**
   * I3 — un rendement faux. Le défaut n'est pas simulé dans le moteur mais dans
   * l'encadrement, ce qui revient au même : c'est l'écart entre le catalogue et
   * la fiche fabricant qu'on éprouve, et E1-7 en a trouvé douze.
   */
  it('I3 nomme le matériau, le taux observé et l’encadrement violé', () => {
    const bounds = new Map(consumptionBoundByMaterialKey);
    const paint = bounds.get('painting:Peinture acrylique mate')!;
    bounds.set('painting:Peinture acrylique mate', {
      ...paint,
      min_per_m2: 0.5,
      max_per_m2: 0.6,
    });

    const violations = invariantViolations(engine, ROOM, { bounds }).filter(
      (v) => v.startsWith('[I3] wall_painting'),
    );

    expect(violations).toEqual([
      '[I3] wall_painting : Peinture acrylique mate — 0.091 L/m² consommés, ' +
        'encadrement 0.500 L/m² à 0.600 L/m² ' +
        `(${paint.basis})`,
    ]);
  });

  /** I3 — un matériau lié sans encadrement déclaré n'est pas un silence. */
  it('I3 signale un matériau sans encadrement plutôt que de le sauter', () => {
    const violations = invariantViolations(engine, ROOM, {
      bounds: new Map(),
      cases: [caseFor('wall_painting', SkillLevel.BEGINNER)],
    }).filter((v) => v.startsWith('[I3]'));

    expect(violations).toEqual([
      '[I3] wall_painting : Peinture acrylique mate — aucun encadrement de consommation déclaré ' +
        '(materials/consumption-bounds.data.ts)',
      '[I3] wall_painting : Sous-couche universelle — aucun encadrement de consommation déclaré ' +
        '(materials/consumption-bounds.data.ts)',
    ]);
  });

  /**
   * I4 — le défaut d'E1-5, tel quel : un format unique, le plus petit. Pour les
   * 6,661 L de peinture de la chambre de référence, c'est exactement les
   * 14 pots de 0,5 L que citait `docs/REPRISE_PROJET.md`, là où 5 L + 2,5 L
   * suffisent en deux contenants.
   */
  it('I4 nomme le panachage qui fait mieux, et de combien', () => {
    class SmallestFormatOnly extends EstimationEngine {
      selectBestPackaging(
        adjustedQty: number,
        packagings: PackagingInput[],
      ): SelectedPackaging {
        const format = smallestOf(packagings);
        return singleFormat(
          format,
          Math.ceil(adjustedQty / format.quantity_per_unit - 1e-9),
        );
      }
    }

    const violations = violationsOf('[I4]', new SmallestFormatOnly());

    expect(violations).toContain(
      '[I4] wall_painting · intermediate · standard : Peinture acrylique mate — ' +
        '14 contenants pour 7.000 L, alors que 5 suffisent pour 7.000 L',
    );
  });

  /**
   * I5 — l'inversion des niveaux. DATA-3 superpose au catalogue des facteurs
   * appris bornés à ±10 points et à 0-30 % : un expert au-dessus d'un débutant
   * est parfaitement représentable, et rien d'autre que cet invariant ne
   * l'interdit.
   */
  it('I5 nomme le matériau et les deux quantités que le niveau inverse', () => {
    const BUMP: Record<string, number> = {
      beginner: 0,
      intermediate: 10,
      expert: 20,
    };
    class InvertedSkill extends EstimationEngine {
      resolveWasteFactor(
        wasteFactors: WasteFactorInput[],
        poseType: string,
        skillLevel: string,
      ): ResolvedWasteFactor {
        const base = super.resolveWasteFactor(
          wasteFactors,
          poseType,
          skillLevel,
        );
        return { ...base, percent: base.percent + (BUMP[skillLevel] ?? 0) };
      }
    }

    const violations = violationsOf('[I5]', new InvertedSkill());

    expect(violations).toContain(
      '[I5] wall_painting · pose standard : Peinture acrylique mate — ' +
        '7.267 L en intermediate contre 6.964 L en beginner',
    );
  });

  /**
   * I6 — la question requise à venir. Le cas est fabriqué de toutes pièces
   * parce que c'est précisément ce qu'on veut démontrer : une « hauteur sous
   * plafond » ajoutée demain à un ouvrage sera éprouvée sans qu'on touche au
   * harnais, en déclarant ses valeurs d'épreuve dans la configuration.
   */
  describe('I6 — une question requise ajoutée demain', () => {
    const base = caseFor('wall_painting', SkillLevel.BEGINNER);
    const withHeightQuestion: HarnessCase = {
      ...base,
      poseType: POSE_UNIQUE_CASE,
      workType: {
        ...base.workType,
        contextual_questions: [
          {
            key: 'ceiling_height_cm',
            type: 'number',
            label_fr: 'Hauteur sous plafond',
            required: true,
          },
        ],
      },
    };

    it('refuse de conclure tant qu’aucune valeur d’épreuve n’est déclarée', () => {
      const violations = invariantViolations(engine, ROOM, {
        cases: [withHeightQuestion],
      }).filter((v) => v.startsWith('[I6]'));

      expect(violations).toEqual([
        '[I6] wall_painting : question requise « ceiling_height_cm » (number) — ' +
          "moins de deux valeurs d'épreuve déclarées, l'invariant ne peut rien affirmer " +
          '(HarnessConfig.questionProbes)',
      ]);
    });

    it('éprouve la question dès que ses valeurs sont déclarées', () => {
      const violations = invariantViolations(engine, ROOM, {
        cases: [withHeightQuestion],
        questionProbes: { ceiling_height_cm: [240, 270] },
      }).filter((v) => v.startsWith('[I6]'));

      expect(violations).toEqual([
        '[I6] wall_painting : question requise « ceiling_height_cm » — ' +
          'les 2 valeurs (240, 270) donnent les mêmes quantités à tous les niveaux : ' +
          'Peinture acrylique mate 6.964 L, Sous-couche universelle 3.830 L',
      ]);
    });
  });

  /**
   * I7 — la division d'un linéaire là où il faut compter des pièces. Le défaut
   * remis ici **est** celui d'avant E1-8, à la ligne près : la quantité ajustée
   * divisée par la longueur de barre, comme si les chutes se raboutaient.
   *
   * Il est rejoué sur une cloison de 17,40 m sous 2,30 m de plafond, et non sur
   * la cloison de référence du harnais : sous 2,50 m au niveau intermédiaire,
   * `2,50 × 1,08 = 2,70` tombe exactement sur la barre et le défaut est
   * invisible. Un invariant qu'on n'éprouve que là où le défaut se cache ne
   * prouve rien — c'est la maladie que ce fichier existe pour soigner.
   */
  describe('I7 — la division d’un linéaire au lieu d’un comptage de pièces', () => {
    /**
     * Le catalogue d'avant E1-8, restitué au montant : aboutable, et portant le
     * forfait de coupe de la plâtrerie. Les deux vont ensemble — c'est ce couple
     * qui produisait les 28 barres, la division seule en donnerait 26.
     */
    const asJointableWithFlatWaste = (
      workItems: Parameters<EstimationEngine['computeEstimationDetailed']>[1],
    ) =>
      workItems.map((wi) => ({
        ...wi,
        materials: wi.materials.map((mat) =>
          mat.offcuts_reusable === false
            ? {
                ...mat,
                offcuts_reusable: true,
                waste_factors: [
                  {
                    pose_type: 'standard',
                    skill_level: 'beginner',
                    factor_percent: 12,
                  },
                  {
                    pose_type: 'standard',
                    skill_level: 'intermediate',
                    factor_percent: 8,
                  },
                  {
                    pose_type: 'standard',
                    skill_level: 'expert',
                    factor_percent: 4,
                  },
                ],
              }
            : mat,
        ),
      }));

    /**
     * Le moteur d'avant E1-8. La substitution porte sur
     * `computeEstimationDetailed`, seul vrai point d'entrée depuis ce lot :
     * remplacer `computeEstimation`, qui n'en est qu'un raccourci, laisserait le
     * harnais lire les lignes du moteur corrigé et l'invariant serait vert sans
     * rien avoir éprouvé.
     */
    class DividingLinear extends EstimationEngine {
      computeEstimationDetailed(
        ...args: Parameters<EstimationEngine['computeEstimationDetailed']>
      ): ReturnType<EstimationEngine['computeEstimationDetailed']> {
        return super.computeEstimationDetailed(
          args[0],
          asJointableWithFlatWaste(args[1]),
        );
      }
    }

    const PARTITION_17M = {
      drywall: { length_m: 17.4, height_m: 2.3, clad_faces: 2 },
    };

    it('nomme le matériau, les barres achetées et celles qu’il faut', () => {
      const violations = invariantViolations(new DividingLinear(), ROOM, {
        cases: [caseFor('drywall', SkillLevel.INTERMEDIATE, POSE_UNIQUE_CASE)],
        declaredBasisByWorkType: PARTITION_17M,
      }).filter((v) => v.startsWith('[I7]'));

      expect(violations).toEqual([
        '[I7] drywall · intermediate · standard : Montant M48 2.7m — ' +
          '28 barres de 2.700 m achetées pour 30 pièces de 2.300 m ' +
          '(1 par barre, 30 barres nécessaires)',
      ]);
    });

    /** Et il est muet sur le moteur corrigé, sur la même cloison. */
    it('reste silencieux sur le moteur qui compte', () => {
      expect(
        invariantViolations(engine, ROOM, {
          cases: [
            caseFor('drywall', SkillLevel.INTERMEDIATE, POSE_UNIQUE_CASE),
          ],
          declaredBasisByWorkType: PARTITION_17M,
        }).filter((v) => v.startsWith('[I7]')),
      ).toEqual([]);
    });
  });
});
