import { EstimationEngine } from '../estimation-engine';
import { SkillLevel } from '../../projects/entities/project-work-item.entity';
import {
  caseFor,
  harnessCases,
  installReadableSnapshots,
  mutualisationReport,
  renderProject,
  SKILL_LEVELS,
  TWO_ROOM_PROJECT,
} from './seeded-catalog-harness';

/**
 * Géométrie 3 — projet à deux pièces : la chambre rectangulaire et le séjour en
 * L des deux autres suites, réunis.
 *
 * Ce que cette géométrie seule peut voir : la mutualisation des achats (ENG-2).
 * Le conditionnement y est choisi **une seule fois**, sur la somme des quantités
 * continues des deux pièces, au lieu d'une décision d'achat par pièce.
 *
 * Le projet étant la composition des deux premières géométries, les
 * contributions de ses instantanés sont, au chiffre près, les quantités des deux
 * autres : la mutualisation se vérifie à la main, sans rejouer le moteur.
 */
installReadableSnapshots();

describe('Harnais — projet à deux pièces (chambre + séjour en L)', () => {
  const engine = new EstimationEngine();

  it.each(harnessCases)(
    '$workType.code · $skillLevel · pose $poseType',
    (testCase) => {
      expect(
        renderProject(engine, TWO_ROOM_PROJECT, [testCase]),
      ).toMatchSnapshot();
    },
  );

  /**
   * Un seul ouvrage par pièce ne peut pas voir la mutualisation **entre
   * ouvrages** : deux matériaux du catalogue servent deux ouvrages chacun —
   * `Sous-couche universelle` (peinture murale + plafond) et `Joint fin 1-6mm`
   * (carrelage sol + mural). Ce sont les deux seules occasions du catalogue de
   * regrouper des achats venus d'ouvrages différents, et un projet réel les
   * rencontre dès qu'on peint les murs et le plafond d'une pièce.
   */
  describe.each(SKILL_LEVELS)('chantiers réalistes — niveau %s', (skill) => {
    it('peinture murale + plafond, deux pièces', () => {
      expect(
        renderProject(engine, TWO_ROOM_PROJECT, [
          caseFor('wall_painting', skill),
          caseFor('ceiling_painting', skill),
        ]),
      ).toMatchSnapshot();
    });

    it('carrelage sol + mural, deux pièces, pose droite', () => {
      expect(
        renderProject(engine, TWO_ROOM_PROJECT, [
          caseFor('floor_tiling', skill, 'straight'),
          caseFor('wall_tiling', skill, 'straight'),
        ]),
      ).toMatchSnapshot();
    });
  });

  describe('mutualisation', () => {
    const report = mutualisationReport(engine, TWO_ROOM_PROJECT);

    it('ne coûte jamais plus cher que l’achat pièce par pièce', () => {
      expect(report.costRegressions).toEqual([]);
    });

    /**
     * Le critère de coût ne suffit pas : il décroît par construction dès qu'on
     * réoptimise sur une quantité plus grande, moteur cassé compris. Ce qui
     * distingue un moteur qui mutualise vraiment, c'est qu'il **évite** des
     * contenants — et il faut l'exiger, sinon le jeu de pièces pourrait dériver
     * jusqu'à ne plus rien démontrer.
     */
    it('évite réellement des contenants sur ce jeu de pièces', () => {
      expect(report.casesThatSave).toBeGreaterThan(0);
    });

    /**
     * Le revers, constaté sur le catalogue réel et non sur un cas construit :
     * mutualiser peut retenir **plus** de contenants, en achetant moins de
     * volume — le critère E1-5 arbitre en coût, pas en nombre de contenants.
     * Ces deux cas sont énumérés, pas tolérés en bloc : le jour où il y en a
     * trois, quelqu'un doit dire lequel a changé et pourquoi.
     */
    it('retient plus de contenants dans exactement deux cas connus', () => {
      expect(report.extraContainers).toMatchInlineSnapshot(`
       [
         "wall_painting · beginner · standard : Peinture acrylique mate — 4 contenants mutualisés contre 3 pièce par pièce, pour 16.000 L au lieu de 17.500 L",
         "ceiling_painting · beginner · standard : Sous-couche universelle — 3 contenants mutualisés contre 2 pièce par pièce, pour 3.500 L au lieu de 5.000 L",
       ]
      `);
    });

    it('garde la trace de chaque pièce dans les contributions', () => {
      expect(report.contributionMismatches).toEqual([]);
    });
  });

  it('couvre les deux matériaux partagés entre ouvrages', () => {
    const shared = renderProject(engine, TWO_ROOM_PROJECT, [
      caseFor('wall_painting', SkillLevel.INTERMEDIATE),
      caseFor('ceiling_painting', SkillLevel.INTERMEDIATE),
    ]);
    // 2 pièces × 2 ouvrages : la sous-couche est achetée en une fois pour quatre
    // demandes. Si la mutualisation inter-ouvrages cassait, ce serait 2.
    expect(shared).toContain('Sous-couche universelle');
    expect(shared).toMatch(/Sous-couche universelle.*4 contributions/);
  });
});
