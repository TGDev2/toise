import { EstimationEngine } from '../estimation-engine';
import { unionPerimeterCm } from '../room-geometry';
import {
  harnessCases,
  installReadableSnapshots,
  invariantViolations,
  L_SHAPED_ROOM,
  renderRoomCase,
} from './seeded-catalog-harness';

/**
 * Géométrie 2 — séjour en L, deux rectangles accolés (ENG-1).
 *
 * Ce que cette géométrie ajoute à la précédente : le périmètre du contour de
 * l'union, dont dépendent toutes les surfaces murales. Une somme naïve des
 * périmètres des deux rectangles donnerait 2 400 cm au lieu de 1 800 — soit
 * 15 m² de murs facturés en trop, sur toute la suite des quantités.
 */
installReadableSnapshots();

describe('Harnais — séjour en L (400 × 300 + 200 × 150), hauteur 250', () => {
  const engine = new EstimationEngine();

  it('a bien le périmètre de contour d’un L, pas la somme de ses rectangles', () => {
    expect(unionPerimeterCm(L_SHAPED_ROOM.room.segments!)).toBe(1800);
  });

  it.each(harnessCases)(
    '$workType.code · $skillLevel · pose $poseType',
    (testCase) => {
      expect(renderRoomCase(engine, L_SHAPED_ROOM, testCase)).toMatchSnapshot();
    },
  );

  it('ne chiffre que les matériaux liés, et jamais moins que le besoin', () => {
    expect(invariantViolations(engine, L_SHAPED_ROOM.room)).toEqual([]);
  });
});
