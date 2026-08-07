import { EstimationEngine, MaterialInput, RoomData } from './estimation-engine';
import {
  adhesiveRateKgPerM2,
  groutVolumeLitresPerM2,
  requiresDoubleButtering,
  resolveJointWidthMm,
  resolveTileGeometry,
  tileAreaCm2,
  tileConsumptionFactor,
  TILE_FORMATS,
} from './tile-consumption';
import { seedMaterials } from '../materials/seed-catalog.data';

/**
 * E1-5 — la loi de consommation confrontée aux **cellules exactes** des tables
 * fabricant, pas à un intervalle.
 *
 * Pourquoi cette suite existe séparément du harnais. L'invariant I3 encadre une
 * consommation par un intervalle, ce qui suffisait tant qu'un matériau avait
 * *une* consommation. Depuis que le format du carreau pilote la colle et le
 * joint, la même colle va de 4,5 à 8 kg/m² et le même joint varie d'un facteur
 * 6 : un intervalle qui contiendrait toute la courbe ne prouverait plus rien.
 * I3 garde donc la géométrie par défaut, et c'est ici que la courbe entière est
 * éprouvée, cellule par cellule.
 *
 * Les valeurs attendues sont **recopiées des fiches**, jamais dérivées du code
 * qu'elles éprouvent.
 */

const engine = new EstimationEngine();

const materialFromSeed = (name: string): MaterialInput => {
  const seed = seedMaterials.find(
    (m) => m.category === 'tiling' && m.name === name,
  );
  if (!seed) {
    throw new Error(`Matériau absent du catalogue seedé : ${name}`);
  }
  return {
    id: name,
    name: seed.name,
    unit: seed.unit,
    yield_per_unit: seed.yield_per_unit,
    consumption_model: seed.consumption_model ?? null,
    /*
     * E1-7 — les facteurs de perte **du catalogue**, et non un tableau vide.
     *
     * Ce fichier envoyait `[]` et commentait « pose implicite : 10 % de perte ».
     * C'était vrai, et c'était le défaut : les 10 % venaient du repli générique
     * de `resolveWasteFactor`, pas d'une ligne du catalogue. Le test s'appuyait
     * donc sur le comportement qu'E1-7 supprime, et ses quantités attendues
     * étaient calibrées dessus — un tableau vide lève désormais.
     *
     * Avec les vraies lignes, la colle et le joint portent `dosedWaste()` : 3 %
     * au niveau intermédiaire, et la même valeur quelle que soit la pose, parce
     * qu'ils se dosent sur la surface nette. Les quantités ci-dessous baissent
     * donc de 10 % à 3 % de marge — c'est le sac de colle en trop que la pose
     * diagonale faisait acheter.
     */
    waste_factors: seed.waste_factors.map((wf) => ({
      pose_type: wf.pose_type,
      skill_level: wf.skill_level,
      factor_percent: wf.factor_percent,
    })),
    packagings: seed.packagings,
  };
};

/**
 * 4 × 3 m au sol, sans ouverture : 12 m² ronds, pour que les kg se lisent. Pose
 * implicite, donc 10 % de perte — les quantités attendues plus bas valent
 * `12 / rendement effectif × 1,1`.
 */
const ROOM: RoomData = {
  length_cm: 400,
  width_cm: 300,
  height_cm: 250,
  openings: [],
};

const quantitiesFor = (
  customParams: Record<string, unknown>,
): Map<string, number> =>
  new Map(
    engine
      .computeEstimation(ROOM, [
        {
          id: 'wi-1',
          work_type_code: 'floor_tiling',
          work_type_label: 'Carrelage sol',
          category: 'tiling',
          surface_target: 'floor',
          skill_level: 'intermediate',
          custom_params: customParams,
          materials: [
            materialFromSeed('Mortier-colle flexible (C2)'),
            materialFromSeed('Joint fin 1-6mm'),
          ],
        },
      ])
      .map((line) => [line.material_name, line.adjusted_qty]),
  );

// ---------------------------------------------------------------------------
// Le seuil réglementaire
// ---------------------------------------------------------------------------

describe('Double encollage — seuils du NF DTU 52.2', () => {
  /**
   * « Double encollage obligatoire à partir de 500 cm², que ce soit avec un
   * mortier-colle (jusqu'à 3 600 cm²) ou un adhésif (jusqu'à 2 200 cm²). »
   */
  it.each([
    [499, false],
    [500, true],
    [1200, true],
    [3600, true],
  ])('mur intérieur : %i cm² → %s', (area, expected) => {
    expect(requiresDoubleButtering(area, 'wall')).toBe(expected);
  });

  /**
   * « En intérieur au-delà de 1 200 cm² quelle que soit la porosité. En
   * intérieur entre 500 et 1 200 cm² uniquement si la porosité < 0,5 ». Le
   * catalogue pose du grès cérame : la condition de porosité est vraie, et la
   * bascule se fait donc dès 500 cm² au sol aussi.
   */
  it.each([
    [400, false],
    [499, false],
    [500, true],
    [1200, true],
    [1201, true],
  ])('sol intérieur, grès cérame : %i cm² → %s', (area, expected) => {
    expect(requiresDoubleButtering(area, 'floor')).toBe(expected);
  });

  /**
   * Le mur est plus restrictif que le sol **en droit** : à 800 cm² il exige le
   * double encollage sans condition, là où le sol ne l'exige que par la faible
   * porosité du carreau. Si la porosité était un jour saisie, c'est ici que les
   * deux destinations cesseraient de coïncider — l'assertion le fige.
   */
  it('impose le double encollage au mur là où le sol le conditionne', () => {
    expect(requiresDoubleButtering(800, 'wall')).toBe(true);
    expect(requiresDoubleButtering(800, 'floor')).toBe(true);
    expect(requiresDoubleButtering(400, 'wall')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Colle — table Cermix
// ---------------------------------------------------------------------------

/**
 * Cellules recopiées de CERMIFLEX (C2S1 ET), identiques chez CERMICOL EXTRA
 * (C1 E), CERMIPLUS 2.0 (C2) et CERMIPLUS RAPID. Colonne « consistance normale ».
 * Là où le DTU impose le double encollage sur une cellule publiée en simple, le
 * supplément de la note (1) — « consommation supplémentaire de 1 à 1.5 kg/m² » —
 * est ajouté à 1,5.
 */
describe('Colle — cellules de la table Cermix, sol intérieur', () => {
  it.each([
    ['20x20', 400, 4.5, 'cellule 300 < S ≤ 500 : 4,5 (U9), simple encollage'],
    ['30x30', 900, 6, 'cellule 500 < S ≤ 1 200 : 4,5 (U9) + note (1) à 1,5'],
    ['45x45', 2025, 7, 'cellule 1 200 < S ≤ 2 200 : 7 (U9)'],
    ['30x60', 1800, 7, 'cellule 1 200 < S ≤ 2 200 : 7 (U9)'],
    ['60x60', 3600, 8, 'cellule 2 200 < S ≤ 3 600 : 8 (E10)'],
  ])('%s (%i cm²) → %s kg/m² — %s', (format, area, expected) => {
    expect(tileAreaCm2(TILE_FORMATS[format])).toBe(area);
    expect(adhesiveRateKgPerM2(area, 'floor')).toBeCloseTo(expected, 6);
  });

  it.each([
    ['S ≤ 300', 300, 3.5],
    ['300 < S ≤ 500', 400, 3.5],
    ['500 < S ≤ 1 200 (double imposé)', 1000, 7],
    ['1 200 < S ≤ 2 200', 2025, 7],
    ['2 200 < S ≤ 3 600', 3600, 8],
  ])('mur intérieur, %s → %s kg/m²', (_label, area, expected) => {
    expect(adhesiveRateKgPerM2(area, 'wall')).toBeCloseTo(expected, 6);
  });

  /**
   * Le fait qui décide de tout le volet catalogue : la consommation ne dépend
   * pas de la classe de colle. Les quatre mortiers seedés portent donc le même
   * rendement, et c'est le format qui les sépare à l'usage.
   */
  it('donne le même rendement de référence aux quatre mortiers-colle', () => {
    const mortars = seedMaterials.filter(
      (m) => m.consumption_model === 'tile_adhesive',
    );
    expect(mortars.map((m) => m.name).sort()).toEqual([
      'Mortier-colle flexible (C2)',
      'Mortier-colle grand format (C2S1)',
      'Mortier-colle rapide (C2F)',
      'Mortier-colle standard (C1)',
    ]);
    expect(new Set(mortars.map((m) => m.yield_per_unit))).toEqual(
      new Set([0.14]),
    );
  });
});

// ---------------------------------------------------------------------------
// Joint — formule Cermix contre la table de la même fiche
// ---------------------------------------------------------------------------

/**
 * Densité apparente impliquée par le coefficient publié : CERMIJOINT COLOR
 * écrit « 0,17 × ép(mm) × largeur de joint(mm) × (L + l) / (L × l) » avec L et
 * l en centimètres, ce qui vaut `d = 1,7` quand tout est ramené au millimètre.
 * Bostik publie la même formule en nommant explicitement le coefficient
 * « D / 10 », ce qui confirme la lecture.
 */
const CERMIX_GROUT_DENSITY = 1.7;

/**
 * Épaisseur avec laquelle Cermix a **généré sa propre table** — constatée, pas
 * supposée : c'est la seule valeur de la plage « 7-10 mm » que la fiche annonce
 * qui reproduit ses 16 cellules de 20 × 20 à 60 × 60. Les épaisseurs retenues
 * par le moteur, elles, suivent le format (8 à 10 mm) : la table est une
 * illustration au bas de la plage, pas un carreau réel.
 */
const CERMIX_TABLE_THICKNESS_MM = 7;

describe('Joint — la formule reproduit la table CERMIJOINT COLOR', () => {
  /** Cellules de la fiche, en kg/m², par format et largeur de joint. */
  const publishedTable: Array<[string, number, number, number, number]> = [
    // format, joint 1 mm, 2 mm, 3 mm, 6 mm
    ['20x20', 0.1, 0.2, 0.4, 0.7],
    ['30x30', 0.1, 0.2, 0.2, 0.5],
    ['45x45', 0.1, 0.1, 0.2, 0.3],
    ['60x60', 0.1, 0.1, 0.1, 0.2],
  ];

  it.each(publishedTable)(
    '%s — 1 / 2 / 3 / 6 mm → %s / %s / %s / %s kg/m²',
    (format, ...cells) => {
      const geometry = {
        ...TILE_FORMATS[format],
        thickness_mm: CERMIX_TABLE_THICKNESS_MM,
      };

      [1, 2, 3, 6].forEach((jointWidth, i) => {
        const computed =
          groutVolumeLitresPerM2(geometry, jointWidth) * CERMIX_GROUT_DENSITY;
        // La table est arrondie au dixième et ne descend jamais sous 0,1 :
        // c'est son plancher d'affichage, pas une consommation.
        const rounded = Math.max(0.1, Math.round(computed * 10) / 10);
        expect(rounded).toBeCloseTo(cells[i], 6);
      });
    },
  );

  /**
   * La géométrie de référence du modèle, où le facteur vaut 1 et où le
   * rendement catalogue s'applique tel quel. Deux ancrages indépendants tombent
   * sur le même chiffre : la cellule publiée « 45 × 45, joint 3 mm » vaut 0,2 ;
   * la formule, à l'épaisseur de 9 mm retenue pour ce format, vaut 0,204.
   */
  it('vaut 0,204 kg/m² à la géométrie de référence, pour 0,2 publié', () => {
    const reference = TILE_FORMATS['45x45'];
    expect(
      groutVolumeLitresPerM2(reference, reference.default_joint_width_mm) *
        CERMIX_GROUT_DENSITY,
    ).toBeCloseTo(0.204, 3);

    const grout = seedMaterials.find((m) => m.name === 'Joint fin 1-6mm')!;
    expect(1 / grout.yield_per_unit).toBeCloseTo(0.2, 6);
  });
});

// ---------------------------------------------------------------------------
// Résolution des réponses
// ---------------------------------------------------------------------------

describe('Résolution du format et de la largeur de joint', () => {
  it('retient le 45 × 45 au sol et la faïence 25 × 40 au mur sans réponse', () => {
    expect(resolveTileGeometry({}, 'floor')).toBe(TILE_FORMATS['45x45']);
    expect(resolveTileGeometry({}, 'wall')).toBe(TILE_FORMATS['25x40']);
  });

  it('retombe sur le défaut plutôt que de lever sur un format inconnu', () => {
    expect(resolveTileGeometry({ tile_format: '13x13' }, 'floor')).toBe(
      TILE_FORMATS['45x45'],
    );
  });

  it.each([
    ['20x20', 5],
    ['30x30', 3],
    ['45x45', 3],
    ['30x60', 3],
    ['60x60', 2],
    ['25x40', 3],
  ])('recommande %s mm de joint pour un %s', (format, expected) => {
    expect(TILE_FORMATS[format].default_joint_width_mm).toBe(expected);
  });

  it.each([undefined, '', 'auto', 'n’importe quoi', -1])(
    'traite %p comme « recommandé pour ce format »',
    (answer) => {
      const geometry = TILE_FORMATS['60x60'];
      expect(resolveJointWidthMm({ joint_width_mm: answer }, geometry)).toBe(2);
    },
  );

  it('respecte une largeur saisie, y compris hors du défaut', () => {
    expect(
      resolveJointWidthMm({ joint_width_mm: '8' }, TILE_FORMATS['60x60']),
    ).toBe(8);
  });

  it('vaut exactement 1 sur la géométrie de référence', () => {
    const reference = { tile_format: '45x45', joint_width_mm: 'auto' };
    expect(tileConsumptionFactor('tile_adhesive', reference, 'floor')).toBe(1);
    expect(tileConsumptionFactor('tile_grout', reference, 'floor')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Bout en bout : ce que l'artisan voit changer
// ---------------------------------------------------------------------------

describe('Moteur — le format du carreau change les quantités', () => {
  /**
   * 12 m² de sol, pose non déclarée (donc pose droite), niveau intermédiaire,
   * joint recommandé pour le format. Colle : `12 / (0,14 / facteur) × 1,03`.
   * Joint : `12 / (5 / facteur) × 1,03`.
   *
   * E1-7 — le multiplicateur était `× 1,1` avant ce lot : les 10 % du repli
   * générique, que ce fichier obtenait en n'envoyant aucun facteur de perte.
   * Il vaut `× 1,03`, la ligne réelle du catalogue pour un produit **dosé** au
   * niveau intermédiaire. Les cinq quantités baissent donc de 6,4 % à format
   * égal, sans qu'aucune consommation au m² n'ait bougé.
   */
  it.each([
    ['20x20', 56.755, 8.24],
    ['30x30', 75.673, 3.296],
    ['45x45', 88.286, 2.472],
    ['30x60', 88.286, 2.781],
    ['60x60', 100.898, 1.3736],
  ])('%s → %s kg de colle et %s kg de joint', (format, colle, joint) => {
    const quantities = quantitiesFor({ tile_format: format });
    expect(quantities.get('Mortier-colle flexible (C2)')).toBeCloseTo(colle, 2);
    expect(quantities.get('Joint fin 1-6mm')).toBeCloseTo(joint, 2);
  });

  /**
   * Le défaut que ce lot corrige, énoncé tel que le backlog le posait : « un
   * 20 × 20 à joint de 5 mm ne consomme plus le même joint qu'un 60 × 60 à
   * joint de 2 mm ». Facteur 6, et non 1.
   */
  it('sépare d’un facteur 6 le joint d’un 20 × 20 et celui d’un 60 × 60', () => {
    const small = quantitiesFor({ tile_format: '20x20' }).get(
      'Joint fin 1-6mm',
    )!;
    const large = quantitiesFor({ tile_format: '60x60' }).get(
      'Joint fin 1-6mm',
    )!;
    expect(small / large).toBeCloseTo(6, 1);
  });

  /**
   * La largeur de joint saisie prime sur la recommandation, et elle est
   * strictement proportionnelle : c'est la seule variable de la formule que
   * l'utilisateur contrôle directement.
   */
  it('fait varier le joint proportionnellement à la largeur saisie', () => {
    const at2 = quantitiesFor({
      tile_format: '45x45',
      joint_width_mm: '2',
    }).get('Joint fin 1-6mm')!;
    const at8 = quantitiesFor({
      tile_format: '45x45',
      joint_width_mm: '8',
    }).get('Joint fin 1-6mm')!;
    expect(at8 / at2).toBeCloseTo(4, 6);
  });

  /**
   * Ce que la largeur de joint ne doit surtout pas changer : la colle. Une
   * question qui déborderait sur une quantité qui ne la concerne pas serait le
   * symétrique du défaut corrigé ici.
   */
  it('laisse la colle indifférente à la largeur de joint', () => {
    const at2 = quantitiesFor({ tile_format: '45x45', joint_width_mm: '2' });
    const at8 = quantitiesFor({ tile_format: '45x45', joint_width_mm: '8' });
    expect(at2.get('Mortier-colle flexible (C2)')).toBe(
      at8.get('Mortier-colle flexible (C2)'),
    );
  });

  /**
   * Un matériau sans `consumption_model` ne bouge pas d'un gramme quand le
   * format change : c'est ce qui garantit que ce lot n'a touché que la colle et
   * le joint, et pas les 200 autres entrées du catalogue.
   */
  it('laisse intact un matériau sans loi de consommation', () => {
    const tile = materialFromSeed('Carrelage sol 45x45 cm');
    expect(tile.consumption_model).toBeNull();
    expect(
      engine.resolveEffectiveYield(tile, {
        id: 'wi-1',
        work_type_code: 'floor_tiling',
        work_type_label: 'Carrelage sol',
        category: 'tiling',
        surface_target: 'floor',
        skill_level: 'intermediate',
        custom_params: { tile_format: '20x20' },
        materials: [],
      }),
    ).toBe(tile.yield_per_unit);
  });
});
