import {
  FLOOR_FLATNESS_VALUES,
  FloorPrepCandidate,
  resolveFloorFlatness,
  resolveFloorPrep,
  UnknownFloorFlatnessError,
} from './floor-prep';

/**
 * E1-10 — le déclenchement du ragréage et de son primaire, sur le modèle de
 * `wet-room.spec.ts` : le défaut, chaque valeur, la valeur inconnue, la
 * traversée à l'identique, et le couplage primaire ↔ ragréage (même
 * déclencheur, jamais l'un sans l'autre).
 */

const compound: FloorPrepCandidate = {
  id: 'compound',
  name: 'Ragréage autolissant',
  substrate_prep: 'leveling_compound',
};
const primer: FloorPrepCandidate = {
  id: 'primer',
  name: "Primaire d'accrochage carrelage",
  substrate_prep: 'leveling_primer',
};
const tile: FloorPrepCandidate = {
  id: 'tile',
  name: 'Carrelage sol 45x45 cm',
};

describe('resolveFloorFlatness', () => {
  it('retient `flat` sans réponse — le premier choix de l’écran', () => {
    expect(resolveFloorFlatness(undefined)).toBe('flat');
    expect(resolveFloorFlatness(null)).toBe('flat');
    expect(resolveFloorFlatness({})).toBe('flat');
    expect(resolveFloorFlatness({ floor_flatness: '' })).toBe('flat');
    expect(FLOOR_FLATNESS_VALUES[0]).toBe('flat');
  });

  it('rend chaque planéité déclarée telle quelle', () => {
    expect(resolveFloorFlatness({ floor_flatness: 'flat' })).toBe('flat');
    expect(resolveFloorFlatness({ floor_flatness: 'uneven' })).toBe('uneven');
  });

  it('lève sur une planéité inconnue', () => {
    expect(() => resolveFloorFlatness({ floor_flatness: 'bosselé' })).toThrow(
      UnknownFloorFlatnessError,
    );
  });
});

describe('resolveFloorPrep', () => {
  it('ne touche à rien quand aucun matériau ne porte de rôle de préparation', () => {
    const decision = resolveFloorPrep([tile], {});
    expect(decision.kept).toEqual([tile]);
    expect(decision.excluded).toEqual([]);
    expect(decision.inclusionReasonByMaterialId.size).toBe(0);
  });

  it('écarte ragréage ET primaire sur support plan — jamais l’un sans l’autre', () => {
    const decision = resolveFloorPrep([tile, compound, primer], {});

    expect(decision.kept).toEqual([tile]);
    expect(decision.excluded.map((e) => e.material.id)).toEqual([
      'compound',
      'primer',
    ]);
    for (const excluded of decision.excluded) {
      expect(excluded.reason).toBe('substrate_declared_flat');
      expect(excluded.reason_fr).toContain('5 mm');
      expect(excluded.reason_fr).toContain('règle de 2 m');
    }
  });

  it('garde ragréage ET primaire sur support à ragréer, motifs à l’appui', () => {
    const decision = resolveFloorPrep([tile, compound, primer], {
      floor_flatness: 'uneven',
    });

    expect(decision.kept).toEqual([tile, compound, primer]);
    expect(decision.excluded).toEqual([]);
    expect(decision.inclusionReasonByMaterialId.get('compound')).toContain(
      'ragréage',
    );
    expect(decision.inclusionReasonByMaterialId.get('primer')).toContain(
      'NF DTU',
    );
    expect(decision.inclusionReasonByMaterialId.has('tile')).toBe(false);
  });
});
