import { EstimationEngine, MaterialInput, RoomData } from './estimation-engine';
import { EstimationLineItem } from './entities/estimation-result.entity';
import {
  paintingMaterials,
  SeedMaterial,
} from '../materials/seed-catalog.data';

/**
 * Chiffrage d'une chambre standard sur le catalogue RÉELLEMENT seedé
 * (`1711468800006-SeedMaterialsCatalog`, via `seed-catalog.data`), et non sur
 * un fixture d'un ou deux matériaux choisis pour le test.
 *
 * Ce que le service fait en production (`EstimationsService.loadMaterialInputs`)
 * est reproduit à l'identique : pour un `work_type` de catégorie `painting`,
 * TOUS les matériaux actifs et non-éco de cette catégorie sont passés au moteur.
 * Aucun n'est seedé `is_eco`/`is_active = false`, donc les 54 matériaux peinture
 * du seed sont bien ceux que reçoit le moteur.
 */

// Mime `loadMaterialInputs` : même mapping, ids déterministes (aucun facteur
// de perte appris — DATA-3 ne s'applique qu'après des achats réels).
const toMaterialInput = (mat: SeedMaterial, index: number): MaterialInput => ({
  id: `seed-${index}`,
  name: mat.name,
  unit: mat.unit,
  yield_per_unit: mat.yield_per_unit,
  waste_factors: mat.waste_factors.map((wf) => ({
    pose_type: wf.pose_type,
    skill_level: wf.skill_level,
    factor_percent: wf.factor_percent,
  })),
  packagings: mat.packagings.map((p) => ({
    label: p.label,
    quantity_per_unit: p.quantity_per_unit,
    unit: p.unit,
  })),
});

/**
 * Achat exprimé par ligne. Le moteur ne sait aujourd'hui retenir qu'UN
 * conditionnement par ligne ; on lit un éventuel panachage s'il existe, sinon
 * on retombe sur le couple (label, units_needed) unique.
 */
interface PurchaseUnit {
  label: string;
  units: number;
}

const purchaseBreakdown = (line: EstimationLineItem): PurchaseUnit[] => {
  const breakdown = (
    line as EstimationLineItem & { packaging_breakdown?: PurchaseUnit[] }
  ).packaging_breakdown;
  return (
    breakdown ?? [{ label: line.packaging_label, units: line.units_needed }]
  );
};

const ACCESSORY_PATTERN = /Pinceau|Rouleau|Bâche/;

describe('EstimationEngine — catalogue seedé, chambre 4 × 3 × 2,5 m', () => {
  const engine = new EstimationEngine();

  // Chambre 400 × 300 × 250 cm, une porte 83 × 204.
  // Mur net = 2 × (4 + 3) × 2,5 − (0,83 × 2,04) = 35 − 1,6932 = 33,3068 m².
  const room: RoomData = {
    length_cm: 400,
    width_cm: 300,
    height_cm: 250,
    openings: [{ width_cm: 83, height_cm: 204, count: 1 }],
  };

  const workItem = {
    id: 'wi-1',
    work_type_code: 'wall_painting',
    work_type_label: 'Peinture murale',
    category: 'painting',
    surface_target: 'wall',
    skill_level: 'intermediate',
    custom_params: {}, // pose standard, 2 couches par défaut
    materials: paintingMaterials.map(toMaterialInput),
  };

  const lines = engine.computeEstimation(room, [workItem]);

  it('ne génère pas plus de 6 lignes pour une simple peinture murale', () => {
    expect(lines.length).toBeLessThanOrEqual(6);
  });

  it('ne fait pas acheter plus de 15 unités au total', () => {
    const totalUnits = lines.reduce((sum, l) => sum + l.units_needed, 0);
    expect(totalUnits).toBeLessThanOrEqual(15);
  });

  it('ne fait acheter ni pinceaux, ni rouleaux, ni bâches en quantité absurde', () => {
    const excessive = lines
      .filter((l) => ACCESSORY_PATTERN.test(l.material_name))
      .filter((l) => l.units_needed > 5)
      .map((l) => `${l.material_name}: ${l.units_needed}`);
    expect(excessive).toEqual([]);
  });

  it('achète 6,66 L de peinture acrylique mate en 1 pot de 5 L + 1 pot de 2,5 L', () => {
    const paint = lines.find(
      (l) => l.material_name === 'Peinture acrylique mate',
    );
    expect(paint).toBeDefined();
    expect(paint!.adjusted_qty).toBeCloseTo(6.661, 3);
    expect(purchaseBreakdown(paint!)).toEqual([
      { label: 'Pot 5 L', units: 1 },
      { label: 'Pot 2.5 L', units: 1 },
    ]);
  });
});
