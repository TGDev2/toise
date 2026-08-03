import { EstimationEngine } from '../estimation-engine';
import {
  harnessCases,
  installReadableSnapshots,
  invariantViolations,
  RECTANGULAR_ROOM,
  renderRoomCase,
} from './seeded-catalog-harness';

/**
 * Géométrie 1 — chambre rectangulaire 400 × 300 × 250 cm, une porte.
 *
 * C'est le cas de `docs/REPRISE_PROJET.md` §1 : celui sur lequel le moteur
 * produisait 54 lignes et 1 486 unités pour une peinture murale. Il est ici
 * rejoué sur les 7 ouvrages, les 3 niveaux et toutes les poses disponibles.
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

  it('ne chiffre que les matériaux liés, et jamais moins que le besoin', () => {
    expect(invariantViolations(engine, RECTANGULAR_ROOM.room)).toEqual([]);
  });
});
