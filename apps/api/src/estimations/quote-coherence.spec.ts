import {
  classifyDeclared,
  dominantWasteReference,
  impliedWastePercent,
  wasteReferenceRange,
} from './quote-coherence';
import { WasteFactorInput } from './estimation-engine';

/* Fourchettes réellement semées — 1711468800006-SeedMaterialsCatalog.ts:26-93.
 * Les recopier ici plutôt que d'inventer des valeurs : un test qui passe sur des
 * chiffres imaginaires ne dit rien de ce que la page affichera. */

const tileWaste = (): WasteFactorInput[] => [
  { pose_type: 'straight', skill_level: 'beginner', factor_percent: 15 },
  { pose_type: 'straight', skill_level: 'intermediate', factor_percent: 10 },
  { pose_type: 'straight', skill_level: 'expert', factor_percent: 5 },
  { pose_type: 'diagonal', skill_level: 'beginner', factor_percent: 20 },
  { pose_type: 'diagonal', skill_level: 'intermediate', factor_percent: 15 },
  { pose_type: 'diagonal', skill_level: 'expert', factor_percent: 10 },
];

const paintWaste = (): WasteFactorInput[] => [
  { pose_type: 'standard', skill_level: 'beginner', factor_percent: 15 },
  { pose_type: 'standard', skill_level: 'intermediate', factor_percent: 10 },
  { pose_type: 'standard', skill_level: 'expert', factor_percent: 5 },
];

const accessoryWaste = (): WasteFactorInput[] => [
  { pose_type: 'standard', skill_level: 'beginner', factor_percent: 10 },
  { pose_type: 'standard', skill_level: 'intermediate', factor_percent: 5 },
  { pose_type: 'standard', skill_level: 'expert', factor_percent: 2 },
];

describe('wasteReferenceRange', () => {
  it('derives the straight-tiling bracket seeded in the catalogue', () => {
    const range = wasteReferenceRange(tileWaste(), 'straight');
    expect(range.min_percent).toBe(5);
    expect(range.max_percent).toBe(15);
    expect(range.pose_type).toBe('straight');
    expect(range.is_default).toBe(false);
  });

  it('separates diagonal from straight — the whole point of naming the pose', () => {
    const range = wasteReferenceRange(tileWaste(), 'diagonal');
    expect(range.min_percent).toBe(10);
    expect(range.max_percent).toBe(20);
  });

  it('reports the pose it actually used when the requested one is unseeded', () => {
    // Une peinture n'a pas de ligne `diagonal` : le moteur retombe sur `standard`,
    // la référence affichée doit dire `standard` et non `diagonal`, sinon la page
    // annoncerait une fourchette de pose diagonale calculée sur une pose droite.
    const range = wasteReferenceRange(paintWaste(), 'diagonal');
    expect(range.pose_type).toBe('standard');
    expect(range.min_percent).toBe(5);
    expect(range.max_percent).toBe(15);
  });

  it('flags the generic default so the page can say it has no pose reference', () => {
    const range = wasteReferenceRange([], 'straight');
    expect(range.is_default).toBe(true);
    expect(range.min_percent).toBe(10);
    expect(range.max_percent).toBe(10);
  });

  it('exposes one entry per seeded skill level', () => {
    expect(wasteReferenceRange(tileWaste(), 'straight').by_skill).toEqual([
      { skill_level: 'beginner', percent: 15 },
      { skill_level: 'intermediate', percent: 10 },
      { skill_level: 'expert', percent: 5 },
    ]);
  });
});

describe('dominantWasteReference', () => {
  it('ignores the accessory bracket that a minority of materials carries', () => {
    // Composition réelle d'un ouvrage carrelage : carreaux, mortier et joint
    // portent tileWaste, les croisillons et le coupe-carreaux accessoryWaste.
    const materials = [
      { waste_factors: tileWaste() },
      { waste_factors: tileWaste() },
      { waste_factors: tileWaste() },
      { waste_factors: accessoryWaste() },
      { waste_factors: accessoryWaste() },
    ];
    const range = dominantWasteReference(materials, 'straight');
    expect(range.min_percent).toBe(5);
    expect(range.max_percent).toBe(15);
  });

  it('lands on the paint bracket, which no unit-based rule would find', () => {
    // La peinture se compte en litres — comme le white-spirit, qui porte pourtant
    // la fourchette des accessoires. Une règle « matériaux au m² » ou « au litre »
    // se tromperait ici ; la règle majoritaire, non.
    const materials = [
      { waste_factors: paintWaste() },
      { waste_factors: paintWaste() },
      { waste_factors: paintWaste() },
      { waste_factors: accessoryWaste() },
    ];
    expect(dominantWasteReference(materials, 'standard')).toMatchObject({
      min_percent: 5,
      max_percent: 15,
    });
  });

  it('breaks a tie on the widest bracket — the prudent direction', () => {
    const materials = [
      { waste_factors: tileWaste() },
      { waste_factors: accessoryWaste() },
    ];
    // 5–15 (largeur 10) l'emporte sur 2–10 (largeur 8) : moins de verdicts
    // « au-dessus », donc moins d'écarts signalés à tort.
    expect(dominantWasteReference(materials, 'straight').max_percent).toBe(15);
  });

  it('falls back to the generic default for an ouvrage without materials', () => {
    expect(dominantWasteReference([], 'straight').is_default).toBe(true);
  });
});

describe('impliedWastePercent', () => {
  it('computes the example from the brief: 46 m² billed for 31 m² net', () => {
    expect(impliedWastePercent(46, 31)).toBe(48.4);
  });

  it('returns a negative rate when less is billed than the room needs', () => {
    expect(impliedWastePercent(28, 31)).toBe(-9.7);
  });

  it('returns null rather than Infinity when there is nothing to compare', () => {
    // Une division par zéro afficherait un écart record là où il n'y a aucune
    // information — c'est précisément le cas qui doit rester sans verdict.
    expect(impliedWastePercent(46, 0)).toBeNull();
    expect(impliedWastePercent(46, -1)).toBeNull();
  });
});

describe('classifyDeclared', () => {
  const reference = wasteReferenceRange(tileWaste(), 'straight'); // 5–15

  it('classifies the brief example above the reference', () => {
    expect(classifyDeclared(48.4, reference)).toBe('above_reference');
  });

  it('treats both bounds as inside the bracket', () => {
    // +15 % en pose droite décrit exactement un chantier de débutant : le classer
    // « au-dessus » signalerait un écart là où le catalogue dit qu'il n'y en a pas.
    expect(classifyDeclared(15, reference)).toBe('within_reference');
    expect(classifyDeclared(5, reference)).toBe('within_reference');
    expect(classifyDeclared(10, reference)).toBe('within_reference');
  });

  it('classifies just outside each bound', () => {
    expect(classifyDeclared(15.1, reference)).toBe('above_reference');
    expect(classifyDeclared(4.9, reference)).toBe('below_reference');
  });

  it('has no verdict when there is nothing to compare', () => {
    expect(classifyDeclared(null, reference)).toBe('not_comparable');
  });
});
