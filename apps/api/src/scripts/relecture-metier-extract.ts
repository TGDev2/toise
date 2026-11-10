import * as fs from 'fs';
import * as path from 'path';
import {
  EstimationEngine,
  MaterialInput,
  RoomData,
  WorkItemInput,
} from '../estimations/estimation-engine';
import {
  EstimationLineItem,
  MaterialExclusion,
} from '../estimations/entities/estimation-result.entity';
import {
  caseFor,
  workItemFor,
  materialsForWorkType,
  defaultPoseFor,
  DEFAULT_DECLARED_BASIS,
  HarnessCase,
} from '../estimations/__tests__/seeded-catalog-harness';
import { SkillLevel } from '../projects/entities/project-work-item.entity';

/**
 * E1-12 — extrait du **vrai** moteur (`EstimationEngine`) et du **vrai**
 * catalogue seedé (via le harnais `seeded-catalog-harness.ts`, qui reproduit
 * `EstimationsService.loadMaterialInputs`) les données servant à
 * `docs/RELECTURE_METIER.md`. Aucun chiffre du document n'est saisi à la
 * main : ils sont tous lus dans `docs/relecture-metier.data.json`, produit
 * ici.
 *
 * ```
 * pnpm --filter @toise/api extract:relecture-metier
 * ```
 *
 * Rejouable : si le moteur ou le catalogue change, ce script régénère le
 * JSON et le document peut être remis à jour à l'identique.
 */

interface CaseSpec {
  workTypeCode: string;
  skillLevel: SkillLevel;
  poseType?: string;
  customParams?: Record<string, unknown>;
  room: RoomData;
}

const CASES: CaseSpec[] = [
  {
    workTypeCode: 'wall_painting',
    skillLevel: SkillLevel.INTERMEDIATE,
    room: {
      length_cm: 400,
      width_cm: 350,
      height_cm: 250,
      openings: [
        { width_cm: 83, height_cm: 204, count: 1, type: 'door' },
        { width_cm: 120, height_cm: 100, count: 1, type: 'window' },
      ],
    },
  },
  {
    workTypeCode: 'ceiling_painting',
    skillLevel: SkillLevel.INTERMEDIATE,
    room: {
      length_cm: 400,
      width_cm: 350,
      height_cm: 250,
      openings: [
        { width_cm: 83, height_cm: 204, count: 1, type: 'door' },
        { width_cm: 120, height_cm: 100, count: 1, type: 'window' },
      ],
    },
  },
  {
    workTypeCode: 'floor_tiling',
    skillLevel: SkillLevel.INTERMEDIATE,
    poseType: 'straight',
    customParams: {
      tile_format: '45x45',
      joint_width_mm: '3',
      water_exposure: 'wet_room',
      floor_flatness: 'flat',
    },
    room: {
      length_cm: 300,
      width_cm: 220,
      height_cm: 250,
      openings: [{ width_cm: 73, height_cm: 204, count: 1, type: 'door' }],
    },
  },
  {
    workTypeCode: 'wall_tiling',
    skillLevel: SkillLevel.INTERMEDIATE,
    poseType: 'straight',
    customParams: {
      water_exposure: 'wet_room',
    },
    room: {
      length_cm: 200,
      width_cm: 180,
      height_cm: 220,
      openings: [{ width_cm: 73, height_cm: 204, count: 1, type: 'door' }],
    },
  },
  {
    workTypeCode: 'parquet_flooring',
    skillLevel: SkillLevel.INTERMEDIATE,
    poseType: 'straight',
    customParams: {
      subfloor_type: 'concrete_screed',
      floor_flatness: 'flat',
    },
    room: {
      length_cm: 500,
      width_cm: 400,
      height_cm: 250,
      openings: [
        { width_cm: 83, height_cm: 204, count: 1, type: 'door' },
        { width_cm: 150, height_cm: 120, count: 1, type: 'window' },
      ],
    },
  },
  {
    workTypeCode: 'drywall',
    skillLevel: SkillLevel.INTERMEDIATE,
    // Assiette déclarée (DEFAULT_DECLARED_BASIS du harnais) : la pièce
    // ci-dessous n'est pas lue par un ouvrage `quantity_basis: 'declared'`,
    // elle satisfait seulement la signature de `computeEstimationDetailed`.
    room: {
      length_cm: 400,
      width_cm: 350,
      height_cm: 250,
      openings: [],
    },
  },
  {
    workTypeCode: 'wall_covering',
    skillLevel: SkillLevel.INTERMEDIATE,
    customParams: {
      pattern_repeat_cm: '32',
      cut_margin_cm: '10',
    },
    room: {
      length_cm: 350,
      width_cm: 300,
      height_cm: 250,
      openings: [
        { width_cm: 83, height_cm: 204, count: 1, type: 'door' },
        { width_cm: 120, height_cm: 100, count: 1, type: 'window' },
      ],
    },
  },
];

interface LineOutput {
  material_name: string;
  role: string;
  material_unit: string;
  waste_factor_percent: number;
  waste_factor_source: string;
  number_of_coats?: number;
  adjusted_qty: number;
  packaging_label: string;
  units_needed: number;
  packaging_breakdown?: { label: string; units: number }[];
  pieces_needed?: number;
  piece_length_m?: number;
  pieces_per_bar?: number;
  inclusion_reason_fr?: string;
  justification_text_fr?: string;
  justification_text_unbranded_fr?: string;
  justification_source_url?: string;
}

interface ExclusionOutput {
  material_name: string;
  reason_fr: string;
}

interface CaseOutput {
  work_type_code: string;
  work_type_label_fr: string;
  category: string;
  skill_level: string;
  pose_type: string;
  pose_declared: boolean;
  custom_params: Record<string, unknown>;
  room: RoomData;
  basis: {
    work_surface_m2: number;
    gross_surface_m2: number;
    excluded_surface_m2: number;
    clad_surface_m2: number;
    clad_faces: number;
    frame: {
      stud_count: number;
      stud_length_m: number;
      runner_length_m: number;
    } | null;
  };
  lines: LineOutput[];
  exclusions: ExclusionOutput[];
}

function lineOutput(
  line: EstimationLineItem,
  byId: Map<string, MaterialInput>,
): LineOutput {
  const material = byId.get(line.material_id);
  return {
    material_name: line.material_name,
    role: material?.role ?? '-',
    material_unit: line.material_unit,
    waste_factor_percent: line.waste_factor_percent,
    waste_factor_source: line.waste_factor_source,
    number_of_coats: line.number_of_coats,
    adjusted_qty: line.adjusted_qty,
    packaging_label: line.packaging_label,
    units_needed: line.units_needed,
    packaging_breakdown: line.packaging_breakdown,
    pieces_needed: line.pieces_needed,
    piece_length_m: line.piece_length_m,
    pieces_per_bar: line.pieces_per_bar,
    inclusion_reason_fr: line.inclusion_reason_fr,
    justification_text_fr: line.justification?.text_fr,
    justification_text_unbranded_fr: line.justification?.text_unbranded_fr,
    justification_source_url: line.justification?.source_url,
  };
}

function exclusionOutput(exclusion: MaterialExclusion): ExclusionOutput {
  return {
    material_name: exclusion.material_name,
    reason_fr: exclusion.reason_fr,
  };
}

function runCase(engine: EstimationEngine, spec: CaseSpec): CaseOutput {
  const testCase: HarnessCase = caseFor(
    spec.workTypeCode,
    spec.skillLevel,
    spec.poseType,
  );
  const workItem: WorkItemInput = workItemFor(
    testCase,
    'wi-1',
    spec.customParams ?? {},
    DEFAULT_DECLARED_BASIS,
  );

  const { items: lines, exclusions } = engine.computeEstimationDetailed(
    spec.room,
    [workItem],
  );
  const basis = engine.computeWorkBasis(spec.room, workItem);
  const byId = new Map(
    materialsForWorkType(spec.workTypeCode).map((mat) => [mat.id, mat]),
  );

  return {
    work_type_code: testCase.workType.code,
    work_type_label_fr: testCase.workType.label_fr,
    category: testCase.workType.category,
    skill_level: testCase.skillLevel,
    pose_type: testCase.poseType,
    pose_declared: testCase.poseType !== defaultPoseFor(spec.workTypeCode),
    custom_params: spec.customParams ?? {},
    room: spec.room,
    basis: {
      work_surface_m2: basis.work_surface_m2,
      gross_surface_m2: basis.gross_surface_m2,
      excluded_surface_m2: basis.excluded_surface_m2,
      clad_surface_m2: basis.clad_surface_m2,
      clad_faces: basis.clad_faces,
      frame: basis.frame
        ? {
            stud_count: basis.frame.stud_count,
            stud_length_m: basis.frame.stud_length_m,
            runner_length_m: basis.frame.runner_length_m,
          }
        : null,
    },
    lines: lines.map((line) => lineOutput(line, byId)),
    exclusions: exclusions.map(exclusionOutput),
  };
}

function main(): void {
  const engine = new EstimationEngine();
  const results = CASES.map((spec) => runCase(engine, spec));

  const outPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'docs',
    'relecture-metier.data.json',
  );
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n', 'utf-8');
  console.log(
    `[relecture-metier] ${results.length} ouvrages écrits dans ${outPath}`,
  );
  for (const result of results) {
    console.log(
      `  - ${result.work_type_code} : ${result.lines.length} lignes, ` +
        `${result.exclusions.length} exclusion(s)`,
    );
  }
}

main();
