import {
  LAYING_PATTERN_PARAM,
  POSE_UNIQUE,
  POSES_BY_WORK_TYPE,
  UnknownLayingPoseError,
  resolveLayingPose,
} from './pose-types';
import { seedWorkTypes } from '../projects/work-types.data';

/**
 * E1-7 — `POSES_BY_WORK_TYPE` est une **seconde description des ouvrages**, et
 * la leçon 15 dit ce qu'il advient de celles qu'on laisse vivre sans laisse :
 * elles divergent, et c'est la copie qui finit par décider. Ici la copie décide
 * d'une quantité — quelle pose sert à chiffrer — donc sa divergence coûterait
 * un carton de carreaux.
 *
 * Les deux premiers tests l'attachent à `work-types.data.ts` dans les deux
 * sens : une entrée par ouvrage seedé, et la même liste, dans le même ordre,
 * que les options de sa question. Ce que la table ajoute et que la question ne
 * porte pas — le fait que la **première** option soit celle qu'on retient sans
 * réponse — est éprouvé par les tests de résolution qui suivent.
 */
describe('Poses par ouvrage — la table et les questions disent la même chose', () => {
  it('couvre exactement les ouvrages seedés', () => {
    expect(Object.keys(POSES_BY_WORK_TYPE).sort()).toEqual(
      seedWorkTypes.map((wt) => wt.code).sort(),
    );
  });

  it('reprend, dans l’ordre, les options de la question de calepinage', () => {
    for (const workType of seedWorkTypes) {
      const question = workType.contextual_questions.find(
        (q) => q.key === LAYING_PATTERN_PARAM,
      );
      const expected = question
        ? (question.options ?? []).map((o) => o.value)
        : [POSE_UNIQUE];

      expect(POSES_BY_WORK_TYPE[workType.code]).toEqual(expected);
    }
  });

  it('déclare la question requise partout où l’ouvrage a plusieurs poses', () => {
    for (const workType of seedWorkTypes) {
      const question = workType.contextual_questions.find(
        (q) => q.key === LAYING_PATTERN_PARAM,
      );
      if (POSES_BY_WORK_TYPE[workType.code].length > 1) {
        // Facultative, la question laisserait le calepinage au hasard du client
        // sur un écart de 5 à 15 points de perte.
        expect(question?.required).toBe(true);
      } else {
        expect(question).toBeUndefined();
      }
    }
  });
});

describe('resolveLayingPose', () => {
  it('retient la première pose quand la question n’est pas répondue', () => {
    expect(resolveLayingPose('floor_tiling', {})).toBe('straight');
    expect(resolveLayingPose('parquet_flooring', undefined)).toBe('straight');
    expect(resolveLayingPose('wall_covering', {})).toBe(POSE_UNIQUE);
  });

  it('honore la pose déclarée', () => {
    expect(
      resolveLayingPose('parquet_flooring', {
        laying_pattern: 'herringbone',
      }),
    ).toBe('herringbone');
  });

  /**
   * Le cas qui distingue une demande mal formée d'un trou de catalogue : les
   * chevrons existent au parquet et **pas** au carrelage, faute d'une source
   * qui les chiffre. Les rabattre sur la pose droite rendrait un prix de pose
   * droite pour un chantier en chevrons, en silence.
   */
  it('refuse une pose que l’ouvrage n’offre pas', () => {
    expect(() =>
      resolveLayingPose('floor_tiling', { laying_pattern: 'herringbone' }),
    ).toThrow(UnknownLayingPoseError);
  });

  /**
   * Le miroir du test précédent, et la raison pour laquelle le refus est
   * restreint : une peinture n'a **qu'un** prix possible, quelle que soit la
   * pose annoncée. Lever ici casserait un client d'API qui envoie un paramètre
   * inutile, sans protéger d'aucun chiffrage faux.
   */
  it('ignore une pose annoncée sur un ouvrage sans variante', () => {
    expect(
      resolveLayingPose('wall_painting', { laying_pattern: 'straight' }),
    ).toBe(POSE_UNIQUE);
  });

  it('traite un ouvrage inconnu comme un ouvrage sans variante', () => {
    expect(resolveLayingPose('futur_ouvrage', {})).toBe(POSE_UNIQUE);
  });
});
