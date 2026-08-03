import { EstimationEngine, MaterialInput, RoomData } from './estimation-engine';
import { EstimationLineItem } from './entities/estimation-result.entity';
import { seedMaterials, SeedMaterial } from '../materials/seed-catalog.data';
import { workTypeMaterialLinks } from '../materials/work-type-materials.data';

/**
 * Chiffrage d'une chambre standard sur le catalogue et la liaison ouvrage →
 * matériaux RÉELLEMENT seedés (`1711468800006-SeedMaterialsCatalog` pour les
 * matériaux, `1711468800066-CreateWorkTypeMaterials` pour la liaison), et non
 * sur un fixture d'un ou deux matériaux choisis pour le test.
 *
 * Ce que le service fait en production (`EstimationsService.loadMaterialInputs`,
 * E1-2) est reproduit à l'identique : pour un ouvrage donné, seuls les
 * matériaux liés en base et non optionnels sont passés au moteur — plus toute
 * la catégorie comme avant E1-2.
 */

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

const seedMaterialByKey = new Map<string, SeedMaterial>(
  seedMaterials.map((mat) => [`${mat.category}:${mat.name}`, mat]),
);

/**
 * Mime `loadMaterialInputs` (E1-2) : liaisons non optionnelles d'un ouvrage,
 * résolues dans le catalogue seedé — pas la catégorie entière.
 */
const materialsForWorkType = (workTypeCode: string): MaterialInput[] =>
  workTypeMaterialLinks
    .filter((link) => link.work_type_code === workTypeCode && !link.is_optional)
    .map((link, index) => {
      const seedMaterial = seedMaterialByKey.get(
        `${link.material_category}:${link.material_name}`,
      );
      if (!seedMaterial) {
        throw new Error(
          `Matériau introuvable dans le catalogue seedé : ` +
            `${link.material_category}/${link.material_name}`,
        );
      }
      return toMaterialInput(seedMaterial, index);
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

// Chambre 400 × 300 × 250 cm, une porte 83 × 204.
// Mur net = 2 × (4 + 3) × 2,5 − (0,83 × 2,04) = 35 − 1,6932 = 33,3068 m².
const room: RoomData = {
  length_cm: 400,
  width_cm: 300,
  height_cm: 250,
  openings: [{ width_cm: 83, height_cm: 204, count: 1 }],
};

describe('EstimationEngine — catalogue seedé, chambre 4 × 3 × 2,5 m', () => {
  const engine = new EstimationEngine();

  const workItem = {
    id: 'wi-1',
    work_type_code: 'wall_painting',
    work_type_label: 'Peinture murale',
    category: 'painting',
    surface_target: 'wall',
    skill_level: 'intermediate',
    custom_params: {}, // pose standard, 2 couches par défaut
    materials: materialsForWorkType('wall_painting'),
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

/**
 * E1-2 : le critère réel du backlog — un ouvrage ne charge plus toute sa
 * catégorie — vérifié sur les 7 ouvrages, pas seulement `wall_painting`.
 */
describe.each([
  {
    code: 'wall_painting',
    label_fr: 'Peinture murale',
    category: 'painting',
    surface_target: 'wall',
  },
  {
    code: 'ceiling_painting',
    label_fr: 'Peinture plafond',
    category: 'painting',
    surface_target: 'ceiling',
  },
  {
    code: 'floor_tiling',
    label_fr: 'Carrelage sol',
    category: 'tiling',
    surface_target: 'floor',
  },
  {
    code: 'wall_tiling',
    label_fr: 'Carrelage mural',
    category: 'tiling',
    surface_target: 'wall',
  },
  {
    code: 'parquet_flooring',
    label_fr: 'Parquet ou stratifie',
    category: 'flooring',
    surface_target: 'floor',
  },
  {
    code: 'drywall',
    label_fr: 'Cloison seche',
    category: 'partition',
    surface_target: 'wall',
  },
  {
    code: 'wall_covering',
    label_fr: 'Revetement mural',
    category: 'wall_covering',
    surface_target: 'wall',
  },
])(
  'EstimationEngine — $label_fr ($code), catalogue seedé',
  ({ code, label_fr, category, surface_target }) => {
    const engine = new EstimationEngine();

    it('ne génère pas plus de 6 lignes', () => {
      const workItem = {
        id: `wi-${code}`,
        work_type_code: code,
        work_type_label: label_fr,
        category,
        surface_target,
        skill_level: 'intermediate',
        custom_params: {},
        materials: materialsForWorkType(code),
      };

      const lines = engine.computeEstimation(room, [workItem]);

      expect(lines.length).toBeLessThanOrEqual(6);
    });
  },
);
