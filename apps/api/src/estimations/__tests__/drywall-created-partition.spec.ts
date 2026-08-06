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
 * Le moteur en produit tout autre chose, et pour une raison qui n'est pas dans
 * le moteur : `projects/work-types.data.ts:110` déclare
 * `drywall.surface_target = 'wall'`. `EstimationEngine.computeSurface`
 * (`estimation-engine.ts:334`) lit ce champ et calcule
 * `unionPerimeterCm(segments) × height_cm` — le **périmètre** de la pièce, moins
 * les ouvertures. Pour la chambre de référence : 14 ml × 2,50 m = 35 m² bruts,
 * 33,307 m² nets. L'ouvrage est donc chiffré comme si l'on habillait les quatre
 * murs existants, pas comme si l'on en dressait un cinquième.
 *
 * Ce test n'affirme rien sur le moteur : il affirme la commande du client, en
 * fourchettes larges que n'importe quel métreur accepterait. Il échoue
 * aujourd'hui, et c'est son objet — le défaut est d'assiette, pas d'arrondi.
 *
 * Voir `tasks/todo.md` §Constat pour les champs de saisie qui manquent au modèle
 * de données pour que cette intention soit exprimable.
 */

/**
 * L'intention, telle qu'elle se formule sur un chantier. Elle est passée en
 * `custom_params` parce que c'est le seul canal libre du modèle
 * (`project_work_items.custom_params`, `jsonb`) — et le moteur n'y lit que
 * `laying_pattern` et `number_of_coats`. Ces trois clés n'existent nulle part
 * ailleurs : ni colonne, ni DTO, ni question contextuelle. Les écrire ici, c'est
 * montrer qu'il n'y a aucun endroit où les écrire.
 */
const CREATED_PARTITION = {
  /** Longueur de la cloison à dresser, en mètres linéaires. */
  partition_length_m: 4,
  /** Hauteur sous plafond, identique à celle de la pièce de référence. */
  partition_height_m: 2.5,
  /** Cloison neuve : les deux faces sont à parementer. */
  partition_clad_faces: 2,
};

/** 4 × 2,50 = 10 m² d'ouvrage. */
const PARTITION_AREA_M2 =
  CREATED_PARTITION.partition_length_m * CREATED_PARTITION.partition_height_m;

/** 10 × 2 faces = 20 m² de parement, soit 20 ÷ 3 ≈ 6,7 plaques avant perte. */
const CLAD_AREA_M2 = PARTITION_AREA_M2 * CREATED_PARTITION.partition_clad_faces;

describe('Cloison sèche — créer une cloison de 4 ml dans une chambre 400 × 300 × 250', () => {
  const engine = new EstimationEngine();

  /**
   * Le work item est dérivé du harnais, donc du seed : `surface_target` vient de
   * `work-types.data.ts` et n'est pas recopié à la main. Niveau intermédiaire —
   * celui de l'instantané de référence (`rectangular-room.spec.ts.snap`), qui
   * montre 25 plaques, 28 montants, 11 rails, 5 rouleaux de bande et 2 seaux
   * d'enduit pour cette même chambre.
   */
  const workItem: WorkItemInput = {
    ...workItemFor(
      caseFor('drywall', SkillLevel.INTERMEDIATE),
      'wi-cloison-4ml',
    ),
    custom_params: { ...CREATED_PARTITION },
  };

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
});
