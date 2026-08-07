import { EstimationEngine } from '../estimation-engine';
import { SkillLevel } from '../../projects/entities/project-work-item.entity';
import {
  caseFor,
  materialsForWorkType,
  purchasedVolume,
  RECTANGULAR_ROOM,
  workItemFor,
} from './seeded-catalog-harness';

/**
 * E1-8 — les deux défauts de ce lot, énoncés côte à côte parce qu'ils ont la
 * même racine : **le moteur raisonne en quantité continue là où le métier
 * raisonne en pièces découpées et en conditions de mise en œuvre.**
 *
 * Écrit rouge avant toute correction. Chaque assertion nomme la valeur observée
 * et la valeur attendue : un test qui échoue sans dire *quoi* ne vaut pas mieux
 * qu'un test absent.
 *
 * ---------------------------------------------------------------------------
 * DÉFAUT 1 — le pare-vapeur est acheté sur tous les chantiers
 * ---------------------------------------------------------------------------
 *
 * `Film pare-vapeur PE` est lié à `parquet_flooring` en `is_optional: false`.
 * Il est donc chiffré quel que soit le support, à 1,25 m²/m² pour tenir compte
 * du recouvrement de 20 cm — un ratio juste, sur un déclenchement faux. Le
 * NF DTU 51.11 réserve le film aux supports minéraux : « Dans le cas de
 * supports à base de liants hydrauliques ou de supports minéraux […], un film
 * pare-vapeur doit être mis en œuvre. » Sur un plancher bois, ces 15 m² de film
 * sont un rouleau acheté pour rien.
 *
 * ---------------------------------------------------------------------------
 * DÉFAUT 2 — l'ossature est comptée en mètres puis divisée par la barre
 * ---------------------------------------------------------------------------
 *
 * Un montant se coupe à la hauteur et sa chute ne se ressoude pas : sous 2,50 m
 * de plafond, une barre de 2,70 m donne **un** montant, pas 1,08. Le moteur
 * divise pourtant un linéaire par la longueur de barre, comme si les chutes
 * s'aboutaient bout à bout — ce qui est vrai d'un rail, posé en continu au sol
 * et au plafond, et faux d'un montant.
 *
 * L'écart change de signe avec la géométrie, et c'est ce qui le rend
 * indétectable à l'œil. Il vaut exactement `hauteur × (1 + perte)` contre la
 * longueur de barre :
 *
 *  - sous 2,50 m au niveau intermédiaire, `2,50 × 1,08 = 2,70` **tombe sur** la
 *    barre de 2,70 m : le compte est juste par coïncidence, et le défaut
 *    invisible ;
 *  - sous le même plafond au niveau confirmé, `2,50 × 1,04 = 2,60` : sous-achat ;
 *  - sous 2,30 m au niveau intermédiaire, `2,30 × 1,08 = 2,48` : sous-achat de
 *    deux barres sur trente, l'ossature achetée à 93 % de ce qu'elle demande ;
 *  - sur une cloison courte, le forfait de perte dépasse la chute réelle et fait
 *    au contraire **sur**-acheter une barre.
 *
 * Les deux sens sont ci-dessous, et c'est important : une correction qui ne
 * ferait que monter les quantités serait une marge déguisée, pas un métré.
 */

describe('E1-8 — pièces découpées et conditions de mise en œuvre', () => {
  const engine = new EstimationEngine();

  describe('le pare-vapeur ne dépend pas encore du support', () => {
    const parquetLinesFor = (customParams: Record<string, unknown>) =>
      engine.computeEstimation(RECTANGULAR_ROOM.room, [
        workItemFor(
          caseFor('parquet_flooring', SkillLevel.INTERMEDIATE),
          'wi-parquet',
          customParams,
        ),
      ]);

    /**
     * Le cas métier : on pose un stratifié flottant sur un plancher bois
     * existant. Aucun pare-vapeur n'est nécessaire — le support ne dégage pas
     * d'humidité, et le DTU ne l'exige que sur support minéral.
     */
    it('ne chiffre pas de film sur un plancher bois', () => {
      const filmLine = parquetLinesFor({ subfloor_type: 'wood_floor' }).find(
        (line) => line.material_name === 'Film pare-vapeur PE',
      );

      expect(
        filmLine && {
          achat: `${filmLine.units_needed} × ${filmLine.packaging_label}`,
          pour: `${filmLine.adjusted_qty} ${filmLine.material_unit}`,
        },
      ).toBeUndefined();
    });

    /** Sur béton ou chape, en revanche, il doit rester — et dire pourquoi. */
    it('chiffre le film sur béton ou chape', () => {
      const filmLine = parquetLinesFor({
        subfloor_type: 'concrete_screed',
      }).find((line) => line.material_name === 'Film pare-vapeur PE');

      expect(filmLine).toBeDefined();
    });
  });

  describe('les montants se comptent en barres, pas en mètres divisés', () => {
    /**
     * Le compte de barres d'une cloison, avec ce qu'il faut pour le relire :
     * le nombre d'emplacements de la trame et la longueur d'un montant.
     */
    const studPurchase = (lengthM: number, heightM: number) => {
      const workItem = workItemFor(
        caseFor('drywall', SkillLevel.INTERMEDIATE),
        'wi-cloison',
        {},
        { drywall: { length_m: lengthM, height_m: heightM, clad_faces: 2 } },
      );
      const basis = engine.computeWorkBasis(RECTANGULAR_ROOM.room, workItem);
      const line = engine
        .computeEstimation(RECTANGULAR_ROOM.room, [workItem])
        .find((l) => l.material_name === 'Montant M48 2.7m')!;
      const material = materialsForWorkType('drywall').find(
        (m) => m.name === 'Montant M48 2.7m',
      )!;

      return {
        emplacements: basis.frame!.stud_count,
        barres: line.units_needed,
        metresAchetes: purchasedVolume(line, material),
      };
    };

    /**
     * 4,00 m à l'entraxe 0,60 : 7 travées plus le montant qui ferme la
     * dernière, soit 8 emplacements. Une barre de 2,70 m ne donne qu'un montant
     * de 2,50 m : 8 barres. Le moteur en achète 9 — il divise 22,400 m (20 m de
     * trame plus 12 % de perte) par 2,70.
     */
    it('achète une barre par emplacement sur une cloison de 4 ml', () => {
      const { emplacements, barres } = studPurchase(4, 2.5);

      expect({ emplacements, barres }).toEqual({
        emplacements: 8,
        barres: 8,
      });
    });

    /**
     * 17,40 m à l'entraxe 0,60 sous un plafond de 2,30 m : 29 travées plus un,
     * soit **30 emplacements**, donc 30 barres — une barre de 2,70 m ne donne
     * qu'un montant de 2,30 m, et les 0,40 m de chute ne se ressoudent pas.
     *
     * Le moteur en achète 28 : il calcule 30 × 2,30 = 69,000 m de trame, ajoute
     * 8 % de perte pour 74,520 m, et divise par 2,70. Deux barres manquantes,
     * l'ossature achetée à 93 % de ce qu'elle demande — un chantier arrêté à la
     * dernière travée.
     */
    it('achète une barre par emplacement sur une cloison de 17,40 ml', () => {
      const { emplacements, barres, metresAchetes } = studPurchase(17.4, 2.3);

      expect({ emplacements, barres }).toEqual({
        emplacements: 30,
        barres: 30,
      });
      // 30 barres de 2,70 m : le linéaire acheté, chute comprise.
      expect(metresAchetes).toBeCloseTo(81, 3);
    });

    /**
     * Le rail, lui, ne change pas : il se pose en continu au sol et au plafond,
     * et deux bouts de barre s'aboutent sans perte. C'est ce contraste qui dit
     * que la propriété est **du matériau** et non de la plâtrerie.
     */
    it('laisse les rails comptés au linéaire', () => {
      const workItem = workItemFor(
        caseFor('drywall', SkillLevel.INTERMEDIATE),
        'wi-cloison',
        {},
        { drywall: { length_m: 17.4, height_m: 2.3, clad_faces: 2 } },
      );
      const line = engine
        .computeEstimation(RECTANGULAR_ROOM.room, [workItem])
        .find((l) => l.material_name === 'Rail R48 3m')!;

      // 2 lisses × 17,40 m = 34,800 m, plus 8 % de perte = 37,584 m, en barres
      // de 3 m : 13. Les chutes se rattrapent d'une barre à l'autre.
      expect(line.units_needed).toBe(13);
    });
  });
});
