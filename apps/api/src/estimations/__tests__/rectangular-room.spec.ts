import { EstimationEngine } from '../estimation-engine';
import {
  harnessCases,
  installReadableSnapshots,
  invariantViolations,
  RECTANGULAR_ROOM,
  renderRoomCase,
} from './seeded-catalog-harness';

/**
 * Géométrie 1 — chambre rectangulaire 400 × 300 × 250 cm, une porte. Le moteur
 * produisait 54 lignes et 1 486 unités pour une peinture murale sur ce cas. Il
 * est ici rejoué sur les 7 ouvrages, les 3 niveaux et toutes les poses
 * disponibles.
 *
 * `it.each` sur une liste vide lève (`.each called with an empty Array`) : une
 * énumération qui se viderait ne peut donc pas passer en silence.
 */
installReadableSnapshots();

describe('Harnais — chambre rectangulaire 400 × 300 × 250, une porte 83 × 204', () => {
  const engine = new EstimationEngine();

  it.each(harnessCases)(
    '$workType.code · $skillLevel · pose $poseType',
    (testCase) => {
      expect(
        renderRoomCase(engine, RECTANGULAR_ROOM, testCase),
      ).toMatchSnapshot();
    },
  );

  /**
   * E1-5 — cette suite portait jusqu'ici trois défauts ouverts, énumérés en
   * clair : le joint de `floor_tiling` et celui de `wall_tiling` à 0,25 kg/m²
   * constants, et `tile_format` requis sans effet sur aucune quantité. Ils sont
   * corrigés, et l'assertion est redevenue celle qu'on veut lire : **aucune
   * violation, sans exception ni note de bas de page.**
   */
  it('ne viole aucun invariant métier', () => {
    expect(invariantViolations(engine, RECTANGULAR_ROOM)).toEqual([]);
  });
});
