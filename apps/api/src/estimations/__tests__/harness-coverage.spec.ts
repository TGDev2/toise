import { EstimationEngine } from '../estimation-engine';
import { workTypeMaterialLinks } from '../../materials/work-type-materials.data';
import { SkillLevel } from '../../projects/entities/project-work-item.entity';
import { seedWorkTypes } from '../../projects/work-types.data';
import {
  caseFor,
  harnessCases,
  installReadableSnapshots,
  POSE_UNIQUE_CASE,
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

  /**
   * E1-7 — ce test disait « propose partout la pose implicite ». Il gardait une
   * commodité de harnais : `standard` était ajouté d'office à tous les ouvrages,
   * y compris à ceux dont aucun matériau ne le déclarait, et c'est exactement
   * cette addition qui rendait présentable un chiffrage à 10 % génériques.
   *
   * Ce qu'il garde désormais : chaque ouvrage offre au moins une pose, et
   * `standard` n'apparaît que là où il **est** la pose — les ouvrages sans
   * question de calepinage. Un ouvrage qui demanderait la pose tout en gardant
   * `standard` dans sa liste ferait rougir ce test, et c'est la forme même du
   * défaut d'origine.
   */
  it('n’offre la pose unique que là où l’ouvrage n’a pas de variante', () => {
    for (const workType of seedWorkTypes) {
      const poses = poseTypesForWorkType(workType.code);
      expect(poses.length).toBeGreaterThan(0);

      const asksPose = workType.contextual_questions.some(
        (q) => q.key === 'laying_pattern',
      );
      expect(poses.includes(POSE_UNIQUE_CASE)).toBe(!asksPose);
    }
  });

  /**
   * Le compte est écrit en clair, et doit être modifié à la main quand le seed
   * bouge. C'est voulu : le nombre de cas est la seule chose qu'aucun instantané
   * ne protège — jest signale un instantané devenu obsolète, mais n'échoue
   * jamais dessus, `--ci` compris.
   */
  /*
   * E1-7 : 39 → 33, et le lot **ajoute** deux poses. Ce n'est pas une perte de
   * couverture, c'est la disparition d'un doublon qui n'existait que pour
   * exposer le défaut.
   *
   *   avant : 13 couples, dont un `standard` fabriqué pour chaque ouvrage —
   *           y compris `floor_tiling · standard` et `wall_covering · plain`,
   *           que le produit ne pouvait pas produire ;
   *   après : 11 couples, ceux que l'utilisateur peut décrire —
   *           2 peintures (1) + 2 carrelages (2) + parquet (3, chevrons compris)
   *           + cloison (1) + revêtement mural (1) = 11.
   *
   * Le chemin « question non répondue » reste éprouvé : il est **confondu** avec
   * la pose par défaut de l'ouvrage, que `workItemFor` envoie en n'envoyant
   * rien. C'est la définition même de ce chemin, au lieu d'un cas parallèle.
   */
  it('produit 33 cas — 11 couples (ouvrage, pose) × 3 niveaux', () => {
    expect(harnessCases).toHaveLength(33);
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
   * + 10 % de perte (intermédiaire) = 6,661 L.
   *
   * Cette ligne a porté trois achats successifs, et c'est une bonne mesure de ce
   * que chaque lot a changé : 14 pots de 0,5 L avant E1-5, `5 L + 2,5 L` après,
   * un pot de 10 L depuis E1-9. Le premier était absurde, le deuxième juste au
   * regard d'un coût approché, le troisième est celui qu'on prend au rayon.
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
        'niveau  : intermediate · pose : standard (non déclarée)',
        'surface : brute 35.000 m² · nette 33.307 m² · déduction 1.693 m²',
        '',
        'matériau                        rôle          perte origine   couches   qté ajustée unités achat',
        'Peinture acrylique mate         principal      10 % exact           2       6.661 L      1 1 × Pot 10 L',
        'Sous-couche universelle         sous_couche    10 % exact                   3.664 L      1 1 × Pot 5 L',
        '',
        'total : 2 lignes · 2 contenants',
      ].join('\n'),
    );

    for (const line of rendered.split('\n')) {
      expect(line).toBe(line.trimEnd());
    }
  });
});
