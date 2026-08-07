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

    /**
     * **La propriété centrale du moteur**, et depuis E1-9 un théorème plutôt
     * qu'un espoir : la réunion des achats pièce par pièce est admissible pour
     * le problème mutualisé — sa borne de surplus étant relative, elle survit à
     * la somme — donc l'optimum mutualisé, qui minimise le nombre de
     * contenants, ne peut pas en prendre davantage.
     *
     * Cette liste valait deux cas avant E1-9, dont celui que l'écran affichait
     * « -1 contenant évité » : le critère de coût approché d'E1-5 pouvait
     * préférer quatre pots à trois. Elle doit désormais rester vide, et une
     * seule ligne qui reparaîtrait signalerait que le critère principal n'est
     * plus le nombre de contenants.
     */
    it('n’ajoute jamais un contenant, sur aucun cas du catalogue', () => {
      expect(report.extraContainers).toEqual([]);
    });

    /**
     * Le théorème ne suffit pas : `0 ≤ 0` le vérifie. Ce qui distingue un moteur
     * qui mutualise vraiment, c'est qu'il **évite** des contenants — et il faut
     * l'exiger, sinon le jeu de pièces pourrait dériver jusqu'à ne plus rien
     * démontrer.
     */
    it('évite réellement des contenants sur ce jeu de pièces', () => {
      expect(report.casesThatSave).toBeGreaterThan(0);
    });

    /**
     * Ce que le critère coûte, en toutes lettres. Deux cas sur le catalogue
     * réel, et **à nombre de contenants identique** : 24 seaux dans les deux
     * achats, 8 kg de colle en plus. C'est la pénalité sur les conditionnements
     * marginaux qui parle — l'achat pièce par pièce panachait un seau de 7 kg
     * parmi les seaux de 15, pour gagner 2,3 % du besoin. Sous le seuil de 5 %,
     * une seconde référence sur la liste ne se paie pas.
     *
     * Énumérés, pas tolérés en bloc : le jour où il y en a trois, quelqu'un doit
     * dire lequel a changé et pourquoi.
     */
    it('achète un peu plus de volume dans deux cas connus', () => {
      expect(report.extraVolume).toMatchInlineSnapshot(`
       [
         "wall_tiling · expert · straight : Colle en pâte prête à l'emploi — 360.000 kg mutualisés contre 352.000 kg pièce par pièce, en 24 contenants au lieu de 24",
         "wall_tiling · expert · diagonal : Colle en pâte prête à l'emploi — 360.000 kg mutualisés contre 352.000 kg pièce par pièce, en 24 contenants au lieu de 24",
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
