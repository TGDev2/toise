import { resolveLaborTime } from './labor-time-resolution';
import { seedLaborTimes, LaborSkillLevel } from './labor-times.data';
import { POSES_BY_WORK_TYPE } from '../estimations/pose-types';

/**
 * E2-2 — le contrat de résolution écrit par E2-1 dans `labor-times.data.ts`.
 *
 * Alimenté par `seedLaborTimes` lui-même, jamais par des lignes composées à la
 * main : un fixture qui retire une ligne pour atteindre un repli teste le
 * repli, pas la résolution (leçon 32). Les valeurs attendues sont donc celles
 * du registre réel, et changer le registre fera bouger ce spec — c'est
 * exactement ce qu'on veut d'un catalogue.
 */
describe('resolveLaborTime', () => {
  const LEVELS: LaborSkillLevel[] = ['beginner', 'intermediate', 'expert'];

  describe('1er temps — la ligne exacte (pose, niveau)', () => {
    it('rend le temps débutant quand la source le différencie', () => {
      const time = resolveLaborTime(
        seedLaborTimes,
        'floor_tiling',
        'straight',
        'beginner',
      );
      expect(time?.hours_per_unit).toBe(1.6);
      expect(time?.skill_level).toBe('beginner');
    });
  });

  describe('2e temps — la ligne (pose, tous niveaux)', () => {
    it('rend le temps tous niveaux pour un confirme, qui est ce que les sources publient', () => {
      const time = resolveLaborTime(
        seedLaborTimes,
        'floor_tiling',
        'straight',
        'intermediate',
      );
      expect(time?.hours_per_unit).toBe(0.8);
      expect(time?.skill_level).toBeUndefined();
    });

    it("rend la meme ligne pour un expert : aucune source ne chiffre ce niveau, on n'en invente pas", () => {
      const expert = resolveLaborTime(
        seedLaborTimes,
        'floor_tiling',
        'straight',
        'expert',
      );
      const intermediate = resolveLaborTime(
        seedLaborTimes,
        'floor_tiling',
        'straight',
        'intermediate',
      );
      expect(expert).toBe(intermediate);
    });

    it('rend la pose diagonale du carrelage sol, qui a sa propre source', () => {
      const diagonal = resolveLaborTime(
        seedLaborTimes,
        'floor_tiling',
        'diagonal',
        'intermediate',
      );
      const straight = resolveLaborTime(
        seedLaborTimes,
        'floor_tiling',
        'straight',
        'intermediate',
      );
      expect(diagonal?.hours_per_unit).toBe(1.2);
      expect(diagonal?.hours_per_unit).toBeGreaterThan(
        straight!.hours_per_unit,
      );
    });

    it('rend le baton rompu du parquet meme pour un debutant, faute de ligne debutant sur cette pose', () => {
      const time = resolveLaborTime(
        seedLaborTimes,
        'parquet_flooring',
        'herringbone',
        'beginner',
      );
      expect(time?.pose_type).toBe('herringbone');
      expect(time?.hours_per_unit).toBe(1);
      expect(time?.skill_level).toBeUndefined();
    });
  });

  describe('3e temps — la ligne de base de l ouvrage', () => {
    it('retombe sur la pose droite pour une faience en diagonale, qu aucune source ne chiffre', () => {
      const diagonal = resolveLaborTime(
        seedLaborTimes,
        'wall_tiling',
        'diagonal',
        'intermediate',
      );
      expect(diagonal?.pose_type).toBe('straight');
      expect(diagonal?.hours_per_unit).toBe(1.2);
    });

    it('retombe sur la ligne de base plutot que sur la ligne debutant d une autre pose', () => {
      const time = resolveLaborTime(
        seedLaborTimes,
        'wall_tiling',
        'diagonal',
        'beginner',
      );
      // 2,2 h serait la ligne (straight, beginner) : la resolution ne saute
      // pas d'un cran de pose pour recuperer un niveau.
      expect(time?.hours_per_unit).toBe(1.2);
      expect(time?.skill_level).toBeUndefined();
    });
  });

  describe('terminaison', () => {
    /**
     * Le critere de couverture est `POSES_BY_WORK_TYPE`, pas le registre :
     * partir des lignes seedees verifierait que les lignes seedees se
     * resolvent, une tautologie (lecon 31). Ici, tout couple (ouvrage, pose)
     * que le produit peut reellement produire doit trouver un temps.
     */
    const seededCodes = [
      ...new Set(seedLaborTimes.map((t) => t.work_type_code)),
    ];

    it('couvre les 7 ouvrages du produit', () => {
      expect(seededCodes.sort()).toEqual(
        Object.keys(POSES_BY_WORK_TYPE).sort(),
      );
    });

    it.each(seededCodes)(
      'resout toujours %s, quelle que soit la pose offerte et le niveau',
      (code) => {
        for (const pose of POSES_BY_WORK_TYPE[code]) {
          for (const level of LEVELS) {
            const time = resolveLaborTime(seedLaborTimes, code, pose, level);
            expect(time).not.toBeNull();
            expect(time!.hours_per_unit).toBeGreaterThan(0);
            expect(time!.unit_basis).toBe('m2');
          }
        }
      },
    );

    it('resout aussi sans niveau declare', () => {
      for (const code of seededCodes) {
        expect(
          resolveLaborTime(
            seedLaborTimes,
            code,
            POSES_BY_WORK_TYPE[code][0],
            null,
          ),
        ).not.toBeNull();
      }
    });
  });

  describe('trou de donnees', () => {
    it("rend null pour un ouvrage absent du registre plutot qu'un temps d'un autre ouvrage", () => {
      expect(
        resolveLaborTime(
          seedLaborTimes,
          'roof_zinc',
          'standard',
          'intermediate',
        ),
      ).toBeNull();
    });
  });
});
