import { EstimationEngine, WorkItemInput } from '../estimation-engine';
import { SkillLevel } from '../../projects/entities/project-work-item.entity';
import {
  caseFor,
  materialsForWorkType,
  purchasedVolume,
  RECTANGULAR_ROOM,
  workItemFor,
} from './seeded-catalog-harness';

/**
 * « Je crée une cloison de 4 ml dans cette chambre. »
 *
 * C'est l'ouvrage `drywall` tel qu'un artisan le commande : une cloison **neuve**
 * de 4 ml de long sur 2,50 m de haut, parementée sur ses deux faces. Dix mètres
 * carrés d'ouvrage, vingt de parement, soit sept plaques de BA13 (3 m² pièce),
 * huit mètres de rail (haut et bas) et une vingtaine de mètres de montant (un
 * tous les 60 cm, sur 2,50 m).
 *
 * Ce test n'affirme rien sur le moteur : il affirme la commande du client, en
 * fourchettes larges que n'importe quel métreur accepterait.
 *
 * ---------------------------------------------------------------------------
 * CE QU'IL A MONTRÉ, ET CE QU'IL GARDE
 * ---------------------------------------------------------------------------
 *
 * Écrit rouge en E0-4, il l'est resté jusqu'à E1-3, et pour une raison qui
 * n'était pas dans le moteur : `work-types.data.ts` déclarait
 * `drywall.surface_target = 'wall'`, et `computeSurface` en tirait
 * `unionPerimeterCm(segments) × height_cm` — le **périmètre** de la pièce. Pour
 * la chambre de référence : 33,307 m² nets, donc 25 plaques, 28 montants et
 * 11 rails. L'ouvrage était chiffré comme si l'on habillait les quatre murs
 * existants, pas comme si l'on en dressait un cinquième.
 *
 * Trois lots ont été nécessaires : E1-2 pour que l'intention soit
 * **exprimable** (les colonnes `declared_*`), E1-3 pour qu'elle soit **lue**
 * (`WorkItemInput.declared_basis`, `MaterialCatalog.quantity_driver`).
 * Les trois assertions n'ont pas bougé d'un chiffre entre les deux états.
 *
 * Ce qu'il garde, maintenant qu'il est vert : le piège du métré plâtrerie. Un
 * moteur qui doublerait l'ossature avec le nombre de faces sortirait 40 ml de
 * montant et 16 ml de rail — hors des deux fourchettes ci-dessous, et cela sans
 * qu'aucun instantané ne paraisse suspect.
 */

/**
 * L'intention, telle qu'elle se formule sur un chantier — et telle qu'elle
 * s'écrit maintenant dans le modèle : `project_work_items.declared_length_m`,
 * `declared_height_m`, `declared_clad_faces` (E1-2), transportées jusqu'au
 * moteur par `WorkItemInput.declared_basis` (E1-3).
 *
 * Elle est déclarée ici plutôt qu'empruntée au défaut du harnais : ce test est
 * l'endroit où cette cloison-là est décrite, il doit se relire seul.
 */
const CREATED_PARTITION = {
  /** Longueur de la cloison à dresser, en mètres linéaires. */
  length_m: 4,
  /** Hauteur sous plafond, identique à celle de la pièce de référence. */
  height_m: 2.5,
  /** Cloison neuve : les deux faces sont à parementer. */
  clad_faces: 2,
};

/** 4 × 2,50 = 10 m² d'ouvrage. */
const PARTITION_AREA_M2 =
  CREATED_PARTITION.length_m * CREATED_PARTITION.height_m;

/** 10 × 2 faces = 20 m² de parement, soit 20 ÷ 3 ≈ 6,7 plaques avant perte. */
const CLAD_AREA_M2 = PARTITION_AREA_M2 * CREATED_PARTITION.clad_faces;

describe('Cloison sèche — créer une cloison de 4 ml dans une chambre 400 × 300 × 250', () => {
  const engine = new EstimationEngine();

  /**
   * Le work item est dérivé du harnais, donc du seed : `quantity_basis` et
   * `frame_spec` viennent de `work-types.data.ts` et ne sont pas recopiés à la
   * main. Niveau intermédiaire — celui de l'instantané de référence
   * (`rectangular-room.spec.ts.snap`).
   */
  const workItem: WorkItemInput = workItemFor(
    caseFor('drywall', SkillLevel.INTERMEDIATE),
    'wi-cloison-4ml',
    {},
    { drywall: CREATED_PARTITION },
  );

  const lines = engine.computeEstimation(RECTANGULAR_ROOM.room, [workItem]);

  const materialByName = new Map(
    materialsForWorkType('drywall').map((mat) => [mat.name, mat]),
  );
  const lineByName = new Map(lines.map((line) => [line.material_name, line]));

  const lineFor = (name: string) => {
    const line = lineByName.get(name);
    if (!line) {
      throw new Error(
        `Matériau non chiffré par l'ouvrage drywall : ${name} — ` +
          `lignes obtenues : ${[...lineByName.keys()].join(', ')}`,
      );
    }
    return line;
  };

  /**
   * Longueur réellement achetée, barres × longueur de barre. C'est la grandeur
   * du métré : compter les **contenants** ferait passer 11 barres de rail de 3 m
   * (33 ml) pour un résultat proche des 8 à 12 ml attendus, alors qu'il en est à
   * quatre fois trop.
   */
  const purchasedMetres = (name: string): number =>
    purchasedVolume(lineFor(name), materialByName.get(name)!);

  /**
   * L'assiette que le moteur retient, avant toute question de matériau. Les
   * trois assertions qui suivent n'ont de sens que si celle-ci est juste : dix
   * mètres carrés d'ouvrage, vingt de parement, et **une** seule trame.
   */
  it('métre 10 m² d’ouvrage, 20 m² de parement et une seule trame', () => {
    const basis = engine.computeWorkBasis(RECTANGULAR_ROOM.room, workItem);

    expect(basis.work_surface_m2).toBe(PARTITION_AREA_M2);
    expect(basis.clad_surface_m2).toBe(CLAD_AREA_M2);
    // Un montant tous les 0,60 m sur 4,00 m, plus celui qui ferme la dernière
    // travée : 7 + 1. Deux lisses, haute et basse, sur 4 ml.
    expect(basis.frame).toEqual({
      stud_count: 8,
      // E1-8 : la longueur d'**un** montant, portée explicitement. C'est elle
      // qui décide combien de montants tiennent dans une barre de 2,70 m — un
      // seul, ici, et c'est tout l'objet du comptage en pièces.
      stud_piece_length_m: 2.5,
      stud_length_m: 20,
      runner_length_m: 8,
    });
  });

  /**
   * E1-8 — huit emplacements, huit barres.
   *
   * Une barre de 2,70 m ne donne qu'un montant de 2,50 m : les 0,20 m qui
   * restent ne se raboutent sur rien. Le moteur en achetait 9 — il divisait
   * 22,400 m (20 m de trame plus 12 % de forfait de coupe) par 2,70, comme si
   * les chutes se ressoudaient bout à bout.
   *
   * La fourchette 15–25 ml du test ci-dessus accepte les deux réponses : elle
   * était écrite pour attraper un doublement d'ossature, pas une barre. C'est
   * pourquoi cette assertion-ci est exacte et non encadrée.
   */
  it('achète une barre de montant par emplacement, pas une division', () => {
    const line = lineFor('Montant M48 2.7m');

    expect({
      pieces: line.pieces_needed,
      parBarre: line.pieces_per_bar,
      barres: line.units_needed,
    }).toEqual({ pieces: 8, parBarre: 1, barres: 8 });
  });

  /**
   * Le rail, lui, n'a pas bougé : posé en course continue au sol et au plafond,
   * deux bouts de barre s'aboutent. C'est ce contraste, dans le même ouvrage et
   * sur la même trame, qui dit que la propriété est **du matériau**.
   */
  it('laisse les rails comptés au linéaire', () => {
    const line = lineFor('Rail R48 3m');

    expect(line.pieces_needed).toBeUndefined();
    // 2 lisses × 4 m = 8 m, plus 8 % : 8,640 m en barres de 3 m → 3.
    expect(line.units_needed).toBe(3);
  });

  /**
   * 20 m² de parement ÷ 3 m² par plaque = 6,67 → 7 plaques. La fourchette 6–9
   * couvre les deux conventions du métier (avec ou sans chute récupérée) et
   * toute perte catalogue jusqu'à 30 %. Le conditionnement étant « Plaque
   * (3 m²) », `units_needed` **est** le nombre de plaques.
   */
  it('demande entre 6 et 9 plaques de BA13 pour 20 m² de parement', () => {
    expect(CLAD_AREA_M2).toBe(20);

    const plaques = lineFor('Plaque BA13 standard 2.5x1.2m').units_needed;

    expect(plaques).toBeGreaterThanOrEqual(6);
    expect(plaques).toBeLessThanOrEqual(9);
  });

  /**
   * Un montant tous les 60 cm sur 4 ml donne 8 montants, plus celui d'about :
   * 8 à 9 × 2,50 m = 20 à 22,5 ml. Fourchette 15–25 ml pour couvrir aussi
   * l'entraxe 40 cm et l'arrondi à la barre de 2,70 m.
   */
  it('demande entre 15 et 25 ml de montants M48 pour 4 ml de cloison', () => {
    const montants = purchasedMetres('Montant M48 2.7m');

    expect(montants).toBeGreaterThanOrEqual(15);
    expect(montants).toBeLessThanOrEqual(25);
  });

  /**
   * Rail haut et rail bas sur 4 ml : 8 ml. Fourchette 8–12 ml, la borne haute
   * laissant la place à une barre de 3 m entamée et non recoupée.
   */
  it('demande entre 8 et 12 ml de rails R48 pour 4 ml de cloison', () => {
    const rails = purchasedMetres('Rail R48 3m');

    expect(rails).toBeGreaterThanOrEqual(8);
    expect(rails).toBeLessThanOrEqual(12);
  });

  /**
   * Le cœur du lot, dit en une assertion plutôt qu'en commentaire : passer de
   * deux faces à une divise le parement par deux et **ne touche pas** à
   * l'ossature. C'est ce qu'aucune fourchette ci-dessus ne peut affirmer seule,
   * et c'est l'erreur qu'un métreur ne pardonne pas.
   */
  it('ne double que le parement quand on passe d’une face à deux', () => {
    const oneFace = engine.computeEstimation(RECTANGULAR_ROOM.room, [
      workItemFor(
        caseFor('drywall', SkillLevel.INTERMEDIATE),
        'wi-doublage-4ml',
        {},
        { drywall: { ...CREATED_PARTITION, clad_faces: 1 } },
      ),
    ]);
    const qtyByName = new Map(
      oneFace.map((line) => [line.material_name, line.theoretical_qty]),
    );

    for (const name of [
      'Plaque BA13 standard 2.5x1.2m',
      'Vis placo 25mm (x500)',
      'Bande à joint papier 23m',
      'Enduit à joint prêt 7kg',
    ]) {
      // Tolérance 5e-3 : `theoretical_qty` est arrondi au millième par le
      // moteur, et le doubler double l'arrondi. Elle n'affaiblit rien — le
      // défaut qu'on guette ici vaut un facteur 2, pas un millième.
      expect(lineFor(name).theoretical_qty).toBeCloseTo(
        qtyByName.get(name)! * 2,
        2,
      );
    }

    for (const name of ['Rail R48 3m', 'Montant M48 2.7m']) {
      expect(lineFor(name).theoretical_qty).toBe(qtyByName.get(name));
    }
  });
});
