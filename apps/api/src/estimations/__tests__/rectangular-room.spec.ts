import { EstimationEngine } from '../estimation-engine';
import {
  harnessCases,
  installReadableSnapshots,
  invariantViolations,
  RECTANGULAR_ROOM,
  renderRoomCase,
  splitKnownViolations,
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

  describe('invariants métier', () => {
    const { known, others } = splitKnownViolations(
      invariantViolations(engine, RECTANGULAR_ROOM),
    );

    it('n’en viole aucun, hors les deux défauts ouverts', () => {
      expect(others).toEqual([]);
    });

    /**
     * Les deux défauts ouverts, écrits en clair plutôt que tolérés en bloc —
     * même convention que `extraContainers` dans la suite du projet à deux
     * pièces. Ils sont dans le fichier de test, donc hors de portée d'un
     * `jest -u`, et le jour où ils sont corrigés cette liste doit être
     * **supprimée**, pas mise à jour.
     *
     *  - le rendement du joint ne suit ni le format du carreau ni la largeur de
     *    joint : 0,25 kg/m² partout, quand sa fiche Cermix donne 0,1 à 0,2 ;
     *  - `tile_format` est requis à l'écran et lu par aucun calcul.
     */
    it('énumère les deux défauts ouverts, et eux seuls', () => {
      expect(known).toMatchInlineSnapshot(`
       [
         "[I3] floor_tiling : Joint fin 1-6mm — 0.250 kg/m² consommés, encadrement 0.100 kg/m² à 0.200 kg/m² (Cermix CERMIJOINT COLOR (1-6 mm), carreau 45×45, joint 2-3 mm : 0,1-0,2 kg/m²)",
         "[I3] wall_tiling : Joint fin 1-6mm — 0.250 kg/m² consommés, encadrement 0.100 kg/m² à 0.200 kg/m² (Cermix CERMIJOINT COLOR (1-6 mm), carreau 45×45, joint 2-3 mm : 0,1-0,2 kg/m²)",
         "[I6] floor_tiling : question requise « tile_format » — les 5 valeurs (20x20, 30x30, 45x45, 60x60, 30x60) donnent les mêmes quantités à tous les niveaux : Carrelage sol 45x45 cm 13.200 m2, Mortier-colle flexible (C2) 94.286 kg, Joint fin 1-6mm 3.300 kg",
       ]
      `);
    });
  });
});
