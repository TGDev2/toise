import { EstimationEngine } from '../estimation-engine';
import { unionPerimeterCm } from '../room-geometry';
import {
  harnessCases,
  installReadableSnapshots,
  invariantViolations,
  L_SHAPED_ROOM,
  renderRoomCase,
  splitKnownViolations,
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

  /**
   * Les mêmes invariants, sur une géométrie dont aucune surface n'est ronde :
   * un encadrement de consommation ou une minimalité de contenants qui ne
   * tiendrait que sur 12 m² et 33,307 m² ne tiendrait rien du tout.
   */
  describe('invariants métier', () => {
    const { known, others } = splitKnownViolations(
      invariantViolations(engine, L_SHAPED_ROOM),
    );

    it('n’en viole aucun, hors les deux défauts ouverts', () => {
      expect(others).toEqual([]);
    });

    it('énumère les deux défauts ouverts, et eux seuls', () => {
      expect(known).toMatchInlineSnapshot(`
       [
         "[I3] floor_tiling : Joint fin 1-6mm — 0.250 kg/m² consommés, encadrement 0.100 kg/m² à 0.200 kg/m² (Cermix CERMIJOINT COLOR (1-6 mm), carreau 45×45, joint 2-3 mm : 0,1-0,2 kg/m²)",
         "[I3] wall_tiling : Joint fin 1-6mm — 0.250 kg/m² consommés, encadrement 0.100 kg/m² à 0.200 kg/m² (Cermix CERMIJOINT COLOR (1-6 mm), carreau 45×45, joint 2-3 mm : 0,1-0,2 kg/m²)",
         "[I6] floor_tiling : question requise « tile_format » — les 5 valeurs (20x20, 30x30, 45x45, 60x60, 30x60) donnent les mêmes quantités à tous les niveaux : Carrelage sol 45x45 cm 16.500 m2, Mortier-colle flexible (C2) 117.857 kg, Joint fin 1-6mm 4.125 kg",
       ]
      `);
    });
  });
});
