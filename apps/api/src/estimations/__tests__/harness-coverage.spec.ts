import { EstimationEngine } from '../estimation-engine';
import { workTypeMaterialLinks } from '../../materials/work-type-materials.data';
import { SkillLevel } from '../../projects/entities/project-work-item.entity';
import { seedWorkTypes } from '../../projects/work-types.data';
import {
  caseFor,
  harnessCases,
  installReadableSnapshots,
  IMPLICIT_POSE,
  materialsForWorkType,
  poseTypesForWorkType,
  RECTANGULAR_ROOM,
  renderCaseInventory,
  renderRoomCase,
} from './seeded-catalog-harness';

/**
 * Ce que le harnais énumère, et pourquoi on peut le croire.
 *
 * Un harnais de non-régression a un mode de défaillance qui lui est propre :
 * passer au vert en n'ayant rien exécuté. Le dépôt en donne déjà un exemple —
 * `estimation-engine.seeded-catalog.spec.ts` filtrait les accessoires sur
 * `/Pinceau|Rouleau|Bâche/`, qui ne correspond à aucun matériau lié depuis qu'E1-7
 * a retiré les outils : le test se réduisait à `expect([]).toEqual([])`, vert et
 * inutile, sans que rien ne le signale.
 *
 * Les assertions qui suivent gardent l'énumération elle-même.
 */
installReadableSnapshots();

describe('Harnais — couverture du catalogue seedé', () => {
  it('énumère exactement les ouvrages liés à des matériaux', () => {
    const linked = [
      ...new Set(workTypeMaterialLinks.map((l) => l.work_type_code)),
    ].sort();
    const seeded = seedWorkTypes.map((wt) => wt.code).sort();
    expect(linked).toEqual(seeded);
  });

  it('chiffre les 7 ouvrages, chacun avec au moins un matériau', () => {
    expect(seedWorkTypes).toHaveLength(7);
    for (const workType of seedWorkTypes) {
      expect(materialsForWorkType(workType.code).length).toBeGreaterThan(0);
    }
  });

  it('propose partout la pose implicite, en plus des poses du catalogue', () => {
    for (const workType of seedWorkTypes) {
      expect(poseTypesForWorkType(workType.code)).toContain(IMPLICIT_POSE);
    }
  });

  /**
   * Le compte est écrit en clair, et doit être modifié à la main quand le seed
   * bouge. C'est voulu : le nombre de cas est la seule chose qu'aucun instantané
   * ne protège — jest signale un instantané devenu obsolète, mais n'échoue
   * jamais dessus, `--ci` compris.
   */
  it('produit 39 cas — 13 couples (ouvrage, pose) × 3 niveaux', () => {
    expect(harnessCases).toHaveLength(39);
  });

  it('fige l’inventaire des cas et des matériaux liés', () => {
    expect(renderCaseInventory()).toMatchSnapshot();
  });

  /**
   * Le rendu lui-même, contre une référence écrite ici et pas dans un `.snap`.
   *
   * Les 125 instantanés du harnais passent tous par cette fonction : un défaut
   * de remplissage ou une colonne perdue les dégraderait **tous à la fois**, et
   * le premier `-u` bénirait la dégradation. Cette référence-ci se relit dans le
   * fichier de test, où elle se défend.
   *
   * Les chiffres sont vérifiables à la main : mur net = 2 × (4 + 3) × 2,5
   * − 0,83 × 2,04 = 33,3068 m² ; peinture = 33,3068 ÷ 11 × 2 couches = 6,0558 L,
   * + 10 % de perte (intermédiaire) = 6,661 L. L'achat 5 L + 2,5 L est l'exemple
   * même que documente `selectBestPackaging` (E1-5), et le chiffre que citait
   * `docs/REPRISE_PROJET.md` pour montrer que 14 pots de 0,5 L étaient absurdes.
   */
  it('rend une table alignée, lisible et sans espace de fin', () => {
    const rendered = renderRoomCase(
      new EstimationEngine(),
      RECTANGULAR_ROOM,
      caseFor('wall_painting', SkillLevel.INTERMEDIATE),
    );

    expect(rendered).toBe(
      [
        'pièce   : Chambre rectangulaire',
        'ouvrage : Peinture murale (wall_painting) · surface wall',
        'niveau  : intermediate · pose : standard (implicite)',
        'surface : brute 35.000 m² · nette 33.307 m² · déduction 1.693 m²',
        '',
        'matériau                        rôle          perte origine   couches   qté ajustée unités achat',
        'Peinture acrylique mate         principal      10 % exact           2       6.661 L      2 1 × Pot 5 L + 1 × Pot 2.5 L',
        'Sous-couche universelle         sous_couche    10 % exact                   3.664 L      1 1 × Pot 5 L',
        '',
        'total : 2 lignes · 3 contenants',
      ].join('\n'),
    );

    for (const line of rendered.split('\n')) {
      expect(line).toBe(line.trimEnd());
    }
  });
});
