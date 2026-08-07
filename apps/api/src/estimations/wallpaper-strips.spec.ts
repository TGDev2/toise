import { EstimationEngine, MaterialInput } from './estimation-engine';
import { unionPerimeterCm, unionWallRunsCm } from './room-geometry';
import {
  computeStripCut,
  DEFAULT_CUT_MARGIN_CM,
  DEFAULT_PATTERN_REPEAT_CM,
  resolveCutMarginCm,
  resolvePatternRepeatCm,
  RollSpec,
  stripsNeeded,
  stripsPerRoll,
} from './wallpaper-strips';
import { seedMaterials } from '../materials/seed-catalog.data';
import { SkillLevel } from '../projects/entities/project-work-item.entity';
import {
  caseFor,
  L_SHAPED_ROOM,
  materialsForWorkType,
  RECTANGULAR_ROOM,
  workItemFor,
} from './__tests__/seeded-catalog-harness';

/**
 * E1-6 — la découpe en lés, confrontée à l'arithmétique du métier.
 *
 * Ce que ce fichier éprouve que le harnais ne peut pas éprouver : le harnais
 * chiffre ses trois géométries à **une seule** hauteur sous plafond (2,50 m), et
 * c'est précisément la hauteur à laquelle l'ancien calcul surfacique tombait
 * juste par coïncidence — 10,05 / 2,50 donne exactement 4 lés. Un encadrement de
 * consommation ne peut donc rien dire de la marche qui se joue 10 cm plus loin.
 * Ici, chaque hauteur demandée est confrontée cellule par cellule à la découpe
 * réelle, comme `tile-consumption.spec.ts` le fait des tables fabricant.
 */

const engine = new EstimationEngine();

/** Le rouleau standard européen, tel que le catalogue le déclare. */
const STANDARD_ROLL: RollSpec = { width_cm: 53, length_cm: 1005 };
const ROLL_AREA_M2 =
  (STANDARD_ROLL.width_cm * STANDARD_ROLL.length_cm) / 10_000;

/**
 * Les quatre pans de la chambre de référence du harnais (4 × 3 m). Écrits en
 * clair ici parce que c'est sur eux que se lisent les 28 lés : 8 + 8 sur les
 * murs de 4 m (⌈400 / 53⌉ = 8), 6 + 6 sur ceux de 3 m (⌈300 / 53⌉ = 6).
 */
const BEDROOM_WALLS_CM = [400, 400, 300, 300];
const BEDROOM_STRIPS = 28;

const cut = (heightCm: number, repeatCm: number, marginCm: number) =>
  computeStripCut(BEDROOM_WALLS_CM, heightCm, STANDARD_ROLL, {
    pattern_repeat_cm: repeatCm,
    cut_margin_cm: marginCm,
  });

describe('wallpaper-strips — un rouleau ne rend pas sa surface', () => {
  // =========================================================================
  // La matrice demandée : 2,40 / 2,50 / 2,60 m × raccord 0 / 64 cm
  // =========================================================================

  /**
   * Sans marge de coupe : l'arithmétique exacte de la ligne de backlog. C'est
   * elle qui montre la coïncidence de 2,50 m — 4 lés pile — et la marche qui
   * la brise 10 cm plus haut.
   */
  describe('sans marge de coupe (calepinage théorique)', () => {
    it.each([
      // hauteur, raccord, longueur du lé, lés/rouleau, rouleaux entiers
      [240, 0, 240, 4, 7],
      [250, 0, 250, 4, 7],
      [260, 0, 260, 3, 10],
      [240, 64, 304, 3, 10],
      [250, 64, 314, 3, 10],
      [260, 64, 324, 3, 10],
    ])(
      'h %i cm, raccord %i cm → lé de %i cm, %i lés par rouleau, %i rouleaux',
      (heightCm, repeatCm, stripLengthCm, perRoll, rolls) => {
        expect(cut(heightCm, repeatCm, 0)).toMatchObject({
          strip_length_cm: stripLengthCm,
          strips_per_roll: perRoll,
          strips_needed: BEDROOM_STRIPS,
        });
        expect(Math.ceil(cut(heightCm, repeatCm, 0).rolls)).toBe(rolls);
      },
    );

    /**
     * Le défaut, en une assertion. À 2,60 m, l'ancien calcul surfacique — la
     * surface murale nette majorée de la perte, divisée par les 5,3 m² annoncés
     * du rouleau — achetait 8 rouleaux là où la découpe en demande 10 : 20 % de
     * sous-achat, invisible à l'écran et visible sur le dernier mur.
     */
    it('achetait 8 rouleaux à 2,60 m là où il en faut 10', () => {
      const netWallM2 = (1400 * 260 - 83 * 204) / 10_000; // porte non déduite
      const surfacic = Math.ceil((netWallM2 * 1.1) / 5.3);

      expect({
        surfacic,
        enLes: Math.ceil(cut(260, 0, 0).rolls),
      }).toEqual({ surfacic: 8, enLes: 10 });
    });
  });

  /**
   * Avec les 10 cm d'arasement du métier — le défaut réellement livré. La
   * coïncidence de 2,50 m ne tient plus : le lé fait 2,60 m, le rouleau n'en
   * donne plus que 3, et le sous-achat commence une hauteur plus tôt.
   */
  describe('avec la marge de coupe de 10 cm (défaut livré)', () => {
    it.each([
      [240, 0, 250, 4, 7],
      [250, 0, 260, 3, 10],
      [260, 0, 270, 3, 10],
      [240, 64, 314, 3, 10],
      [250, 64, 324, 3, 10],
      [260, 64, 334, 3, 10],
    ])(
      'h %i cm, raccord %i cm → lé de %i cm, %i lés par rouleau, %i rouleaux',
      (heightCm, repeatCm, stripLengthCm, perRoll, rolls) => {
        expect(cut(heightCm, repeatCm, DEFAULT_CUT_MARGIN_CM)).toMatchObject({
          strip_length_cm: stripLengthCm,
          strips_per_roll: perRoll,
        });
        expect(
          Math.ceil(cut(heightCm, repeatCm, DEFAULT_CUT_MARGIN_CM).rolls),
        ).toBe(rolls);
      },
    );

    it('déplace le sous-achat de 2,60 m à 2,50 m', () => {
      // Ce que la ligne de backlog dit « juste par coïncidence » ne l'est que
      // sans arasement. Avec la marge, 2,50 m sous-achète déjà de 30 %.
      expect(Math.ceil(cut(250, 0, 0).rolls)).toBe(7);
      expect(Math.ceil(cut(250, 0, DEFAULT_CUT_MARGIN_CM).rolls)).toBe(10);
    });
  });

  // =========================================================================
  // Les briques de la loi
  // =========================================================================

  describe('stripsPerRoll — la partie entière qui décide de tout', () => {
    it('ne rend que des lés entiers', () => {
      // 10,05 / 2,60 = 3,865 : le dernier tronçon de 2,45 m ne fait pas un lé.
      expect(stripsPerRoll(STANDARD_ROLL, 260)).toBe(3);
    });

    it('rend 4 lés quand la longueur tombe juste', () => {
      // La coïncidence de 2,50 m, isolée : 10,05 / 2,50 = 4,02.
      expect(stripsPerRoll(STANDARD_ROLL, 250)).toBe(4);
    });

    it('rend exactement 3 lés sur un multiple exact de la bobine', () => {
      // 335 × 3 = 1005 : aucune dérive flottante ne doit faire 2 ni 4.
      expect(stripsPerRoll(STANDARD_ROLL, 335)).toBe(3);
    });

    it('échoue en nommant le cas quand aucun lé ne tient dans le rouleau', () => {
      expect(() => stripsPerRoll(STANDARD_ROLL, 1100)).toThrow(
        /ne donne aucun lé de 11 m/,
      );
    });
  });

  describe('stripsNeeded — un lé ne tourne pas un angle', () => {
    it('arrondit chaque pan au lé entier', () => {
      expect(stripsNeeded(BEDROOM_WALLS_CM, STANDARD_ROLL)).toBe(
        BEDROOM_STRIPS,
      );
    });

    /**
     * Le point de métier du lot. Sur le séjour en L, le périmètre total donne
     * 34 lés ; les six pans réels en demandent 36. Compter sur le périmètre
     * sous-compte donc systématiquement, et d'autant plus qu'il y a de pans.
     */
    it('compte plus de lés pan par pan que sur le périmètre total', () => {
      const segments = L_SHAPED_ROOM.room.segments!;
      const onPerimeter = Math.ceil(unionPerimeterCm(segments) / 53);

      expect({
        onPerimeter,
        wallByWall: stripsNeeded(unionWallRunsCm(segments), STANDARD_ROLL),
      }).toEqual({ onPerimeter: 34, wallByWall: 36 });
    });

    it('ne compte aucun lé sur une pièce sans mur', () => {
      expect(stripsNeeded([], STANDARD_ROLL)).toBe(0);
    });

    it('ne fait pas payer un lé de trop sur un pan multiple de la laize', () => {
      // 5 × 53 = 265 : exactement 5 lés, pas 6.
      expect(stripsNeeded([265], STANDARD_ROLL)).toBe(5);
    });
  });

  describe('résolution des paramètres d’ouvrage', () => {
    it('retient un uni et 10 cm d’arasement quand rien n’est répondu', () => {
      expect(resolvePatternRepeatCm({})).toBe(DEFAULT_PATTERN_REPEAT_CM);
      expect(resolveCutMarginCm({})).toBe(DEFAULT_CUT_MARGIN_CM);
      expect(DEFAULT_PATTERN_REPEAT_CM).toBe(0);
      expect(DEFAULT_CUT_MARGIN_CM).toBe(10);
    });

    it('lit les réponses du formulaire, qui sont des chaînes', () => {
      expect(resolvePatternRepeatCm({ pattern_repeat_cm: '64' })).toBe(64);
      expect(resolveCutMarginCm({ cut_margin_cm: '5' })).toBe(5);
    });

    it('accepte zéro comme réponse, sur les deux paramètres', () => {
      expect(resolvePatternRepeatCm({ pattern_repeat_cm: '0' })).toBe(0);
      expect(resolveCutMarginCm({ cut_margin_cm: 0 })).toBe(0);
    });

    it('retombe sur le défaut plutôt que de chiffrer une valeur illisible', () => {
      expect(
        resolvePatternRepeatCm({ pattern_repeat_cm: 'raccord sauté' }),
      ).toBe(DEFAULT_PATTERN_REPEAT_CM);
      expect(resolveCutMarginCm({ cut_margin_cm: -5 })).toBe(
        DEFAULT_CUT_MARGIN_CM,
      );
    });

    /**
     * La marge n'agit, elle aussi, que par marches — d'où la question
     * facultative. À 2,40 m elle fait basculer de 4 lés à 3 ; à 2,50 m les trois
     * options offertes donnent le même achat.
     */
    it('fait basculer une marche à 2,40 m et aucune à 2,50 m', () => {
      expect([5, 10, 15].map((m) => cut(240, 0, m).strips_per_roll)).toEqual([
        4, 4, 3,
      ]);
      expect([5, 10, 15].map((m) => cut(250, 0, m).strips_per_roll)).toEqual([
        3, 3, 3,
      ]);
    });
  });

  // =========================================================================
  // Le catalogue : les dimensions du rouleau sont une donnée, pas une constante
  // =========================================================================

  describe('catalogue', () => {
    const rollMaterials = seedMaterials.filter(
      (m) => m.roll_width_cm && m.roll_length_cm,
    );

    /**
     * La liste est figée, et non filtrée sur un critère : un papier peint ajouté
     * au catalogue sans dimensions de rouleau serait chiffré au mètre carré en
     * silence — exactement le défaut que ce lot corrige. Ici, il fait rougir ce
     * test. C'est ainsi que « Papier peint intissé texturé », rangé loin de ses
     * semblables dans le fichier de seed, a été rattrapé.
     */
    it('déclare les six papiers peints et le papier d’apprêt', () => {
      expect(rollMaterials.map((m) => m.name).sort()).toEqual([
        "Papier d'apprêt lisse",
        'Papier peint intissé texturé',
        'Papier peint intissé uni',
        'Papier peint intissé à motif',
        'Papier peint traditionnel',
        'Papier peint vinyle expansé',
        'Papier peint vinyle sur intissé',
      ]);
    });

    /**
     * Le complément du test précédent : aucun matériau **posé sur un rouleau
     * standard** ne doit rester au calcul surfacique. Le critère observable est
     * le libellé du conditionnement, indépendant des colonnes qu'on éprouve.
     */
    it('ne laisse aucun rouleau standard au calcul surfacique', () => {
      const onStandardRoll = seedMaterials.filter((m) =>
        m.packagings.some((p) => p.label.startsWith('Rouleau 10.05m x 0.53m')),
      );

      expect(
        onStandardRoll
          .filter((m) => !m.roll_width_cm || !m.roll_length_cm)
          .map((m) => m.name),
      ).toEqual([]);
      expect(onStandardRoll).toHaveLength(6);
    });

    it('porte plus d’un conditionnement de rouleau — d’où la donnée', () => {
      // C'est la raison d'être des colonnes : une constante de moteur aurait
      // chiffré le papier d'apprêt (10 × 0,50 m) comme un papier peint.
      const shapes = new Set(
        rollMaterials.map((m) => `${m.roll_width_cm}×${m.roll_length_cm}`),
      );
      expect(shapes).toEqual(new Set(['53×1005', '50×1000']));
    });

    /**
     * Le conditionnement et les dimensions décrivent **le même rouleau**. S'ils
     * divergent, l'arrondi au contenant rachète un rouleau sur un besoin qui
     * tombe juste : avec les 5,3 m² arrondis d'avant ce lot, le séjour en L, qui
     * demande exactement 12 rouleaux, en achetait 13.
     */
    it('accorde le conditionnement aux dimensions du rouleau, au centième', () => {
      for (const material of rollMaterials) {
        const area = (material.roll_width_cm! * material.roll_length_cm!) / 1e4;
        expect({
          name: material.name,
          formats: material.packagings.length,
          area: material.packagings[0].quantity_per_unit,
        }).toEqual({ name: material.name, formats: 1, area });
      }
    });
  });

  // =========================================================================
  // Bout en bout, sur le catalogue et les pièces réels
  // =========================================================================

  describe('bout en bout, à travers le moteur', () => {
    const paper: MaterialInput = materialsForWorkType('wall_covering').find(
      (m) => m.roll_spec,
    )!;

    const paperLine = (
      room: (typeof RECTANGULAR_ROOM)['room'],
      params: Record<string, unknown> = {},
    ) =>
      engine
        .computeEstimation(room, [
          workItemFor(
            caseFor('wall_covering', SkillLevel.BEGINNER),
            'wi-1',
            params,
          ),
        ])
        .find((line) => line.material_id === paper.id)!;

    it('chiffre le papier peint comme la découpe, et non au mètre carré', () => {
      const line = paperLine(RECTANGULAR_ROOM.room);
      // 28 lés, 3 par rouleau → 9,333 rouleaux × 5,3265 m² de papier.
      expect(line.theoretical_qty).toBeCloseTo(
        (BEDROOM_STRIPS / 3) * ROLL_AREA_M2,
        3,
      );
    });

    /**
     * Le séjour en L demande **exactement** 12 rouleaux : le cas qui prouve que
     * le conditionnement doit valoir 5,3265 m² et non 5,3. À 5,3, le besoin
     * ressortait à 12,06 rouleaux et l'achat à 13.
     */
    it('n’achète pas un rouleau de trop quand le besoin tombe juste', () => {
      const line = paperLine(L_SHAPED_ROOM.room);
      const rolls = line.theoretical_qty / ROLL_AREA_M2;

      expect(rolls).toBeCloseTo(12, 6);
      expect(Number.isInteger(Math.round(rolls))).toBe(true);
    });

    it('ne déduit pas les ouvertures du nombre de lés', () => {
      // La porte réduit la surface murale nette, jamais la longueur des pans :
      // le lé au-dessus d'une porte se coupe dans un lé entier.
      const withDoor = paperLine(RECTANGULAR_ROOM.room);
      const withoutDoor = paperLine({
        ...RECTANGULAR_ROOM.room,
        openings: [],
      });

      expect(withDoor.theoretical_qty).toBe(withoutDoor.theoretical_qty);
      expect(withDoor.surface_m2).toBeLessThan(withoutDoor.surface_m2);
    });

    it('fait bouger l’achat avec la hauteur sous plafond', () => {
      const rolls = (heightCm: number) =>
        paperLine({ ...RECTANGULAR_ROOM.room, height_cm: heightCm })
          .units_needed;

      // Perte implicite de 10 % comprise : la découpe pure donne 7 · 10 · 10.
      expect([240, 250, 260].map(rolls)).toEqual([8, 11, 11]);
    });

    it('fait bouger l’achat avec le raccord de motif', () => {
      const uni = paperLine(RECTANGULAR_ROOM.room, { pattern_repeat_cm: '0' });
      const raccord = paperLine(RECTANGULAR_ROOM.room, {
        pattern_repeat_cm: '80',
      });

      expect(raccord.units_needed).toBeGreaterThan(uni.units_needed);
    });

    /**
     * Un matériau vendu au rouleau posé sur un ouvrage sans murs échoue en
     * nommant le cas, comme un rail sans trame. Le repli imaginable — le
     * périmètre du sol — serait un chiffrage faux qui ne se signale pas.
     */
    it('refuse de découper des lés sur un ouvrage qui n’a pas de murs', () => {
      const floorItem = {
        ...workItemFor(caseFor('wall_covering', SkillLevel.BEGINNER), 'wi-1'),
        surface_target: 'floor',
      };

      expect(() =>
        engine.computeEstimation(RECTANGULAR_ROOM.room, [floorItem]),
      ).toThrow(/se pose en lés.*ne se chiffre pas sur des murs/s);
    });
  });
});
