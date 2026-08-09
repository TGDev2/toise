import { DataSource } from 'typeorm';
import { migratedDataSource } from './test-database';
import { EstimationsService } from '../../src/estimations/estimations.service';
import { EstimationEngine } from '../../src/estimations/estimation-engine';
import { EstimationResult } from '../../src/estimations/entities/estimation-result.entity';
import { EmailCapture } from '../../src/estimations/entities/email-capture.entity';
import { ApiEstimateRequestDto } from '../../src/estimations/dto/api-estimate-request.dto';
import { PublicQuoteCheckRequestDto } from '../../src/estimations/dto/public-quote-check-request.dto';
import { LearnedWasteFactor } from '../../src/materials/entities/learned-waste-factor.entity';
import { WorkTypeMaterial } from '../../src/materials/entities/work-type-material.entity';
import { MaterialCatalog } from '../../src/materials/entities/material-catalog.entity';
import { WorkType } from '../../src/projects/entities/work-type.entity';
import type { ProjectsService } from '../../src/projects/projects.service';
import type { EmailService } from '../../src/email/email.service';
import type { AnalyticsService } from '../../src/analytics/analytics.service';

/**
 * E1-2 : le câblage réel — migration `1711468800066-CreateWorkTypeMaterials`
 * + `EstimationsService.loadMaterialInputs` — sur PostgreSQL réel et les
 * vraies migrations, pas sur une simulation du chargement comme
 * `estimation-engine.seeded-catalog.spec.ts`.
 */

const WORK_TYPE_CODES = [
  'wall_painting',
  'ceiling_painting',
  'floor_tiling',
  'wall_tiling',
  'parquet_flooring',
  'drywall',
  'wall_covering',
];

function buildEstimationsService(dataSource: DataSource): EstimationsService {
  return new EstimationsService(
    dataSource.getRepository(EstimationResult),
    dataSource.getRepository(LearnedWasteFactor),
    dataSource.getRepository(WorkTypeMaterial),
    dataSource.getRepository(WorkType),
    dataSource.getRepository(EmailCapture),
    {} as ProjectsService,
    new EstimationEngine(),
    {} as EmailService,
    { track: () => undefined } as unknown as AnalyticsService,
  );
}

/** Un partenaire/widget appelle `estimatePublicMulti` : c'est le seul chemin
 * qui accepte les 7 codes sans la restriction à 5 du calculateur public
 * (`PUBLIC_WORK_TYPE_CODES`). */
function makeApiDto(workTypeCode: string): ApiEstimateRequestDto {
  return {
    rooms: [
      {
        length_cm: 400,
        width_cm: 300,
        height_cm: 250,
        openings: [{ width_cm: 83, height_cm: 204, count: 1 }],
        work_items: [
          {
            work_type_code: workTypeCode,
            custom_params: { laying_pattern: 'straight', tile_format: '30x30' },
            // E1-3 : un ouvrage à assiette déclarée exige son linéaire, sa
            // hauteur et son nombre de faces. Les envoyer sur les sept codes
            // est sans effet sur les six autres — `toWorkItemInput` ne les lit
            // que si `quantity_basis = 'declared'`.
            declared_length_m: 4,
            declared_height_m: 2.5,
            declared_clad_faces: 2,
          },
        ],
      },
    ],
  } as ApiEstimateRequestDto;
}

describe('work_type_materials (intégration, PostgreSQL réel)', () => {
  let dataSource: DataSource;
  let service: EstimationsService;

  beforeAll(async () => {
    dataSource = await migratedDataSource();
    service = buildEstimationsService(dataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it.each(WORK_TYPE_CODES)(
    '%s a au moins une liaison non optionnelle en base',
    async (code) => {
      const workType = await dataSource
        .getRepository(WorkType)
        .findOne({ where: { code } });
      expect(workType).not.toBeNull();

      const count = await dataSource.getRepository(WorkTypeMaterial).count({
        where: { work_type_id: workType!.id, is_optional: false },
      });

      expect(count).toBeGreaterThanOrEqual(1);
    },
  );

  /**
   * The cap started at 6 with the E1-3 curation and grew with E1-10, which
   * added mandatory accessories (baseboards, threshold bars) and per-ouvrage
   * consumables (insulation, resilient strip) documented per work type in
   * `docs/MATERIAUX_OUVRAGES.md`. `drywall`'s 8 unconditional lines are the
   * current ceiling across all 7 work types — this guard only catches an
   * unbounded list, not the exact curated count.
   */
  it.each(WORK_TYPE_CODES)(
    'estimatePublicMulti renvoie au plus 8 lignes pour %s',
    async (code) => {
      const result = await service.estimatePublicMulti(makeApiDto(code));

      expect(result.items.length).toBeLessThanOrEqual(8);
    },
  );

  /**
   * E1-3 de bout en bout, contre les vraies migrations : la colonne
   * `quantity_driver` posée par `…080`, lue par `loadMaterialInputs`, appliquée
   * par le moteur. Aucune des suites unitaires ne monte cette chaîne — elles
   * rejouent le catalogue depuis `seed-catalog.data.ts`, donc elles seraient
   * vertes même si la migration n'écrivait rien en base.
   */
  it('métre la cloison sur son assiette déclarée, et non sur la pièce', async () => {
    const result = await service.estimatePublicMulti(makeApiDto('drywall'));

    // 4,00 × 2,50 = 10 m² d'ouvrage, et non les 33,307 m² de mur de la pièce.
    for (const item of result.items) {
      expect(item.surface_m2).toBe(10);
    }

    const qtyByName = new Map(
      result.items.map((i) => [i.material_name, i.theoretical_qty]),
    );
    // Parement : 20 m² ÷ 0,96. Trame : 8 montants × 2,50 m, 2 lisses × 4,00 m.
    expect(qtyByName.get('Plaque BA13 standard 2.5x1.2m')).toBeCloseTo(
      20.833,
      3,
    );
    expect(qtyByName.get('Montant M48 2.7m')).toBe(20);
    expect(qtyByName.get('Rail R48 3m')).toBe(8);
  });

  it('refuse une cloison sans assiette au lieu de la chiffrer sur la pièce', async () => {
    const dto = makeApiDto('drywall');
    delete dto.rooms[0].work_items[0].declared_length_m;

    await expect(service.estimatePublicMulti(dto)).rejects.toThrow(
      /declared_length_m/,
    );
  });

  it('ne chiffre pas un matériau lié en optionnel', async () => {
    const workType = (await dataSource
      .getRepository(WorkType)
      .findOne({ where: { code: 'wall_painting' } }))!;
    // Un matériau volontairement HORS de la curation E1-3 : la satinée est
    // désormais seedée en alternative de `wall_painting` et entrerait en
    // collision avec `UQ_work_type_materials`.
    const material = (await dataSource.getRepository(MaterialCatalog).findOne({
      where: {
        name: 'Peinture tableau noir',
        category: 'painting' as MaterialCatalog['category'],
      },
    }))!;
    expect(material).not.toBeNull();

    const link = dataSource.getRepository(WorkTypeMaterial).create({
      work_type_id: workType.id,
      material_id: material.id,
      role: 'principal',
      is_optional: true,
      display_order: 99,
    });
    await dataSource.getRepository(WorkTypeMaterial).save(link);

    try {
      const result = await service.estimatePublicMulti(
        makeApiDto('wall_painting'),
      );

      expect(
        result.items.some((i) => i.material_name === 'Peinture tableau noir'),
      ).toBe(false);
    } finally {
      await dataSource.getRepository(WorkTypeMaterial).delete(link.id);
    }
  });

  it('refuse de supprimer un matériau encore lié à un ouvrage (FK RESTRICT)', async () => {
    const material = (await dataSource.getRepository(MaterialCatalog).findOne({
      where: {
        name: 'Peinture acrylique mate',
        category: 'painting' as MaterialCatalog['category'],
      },
    }))!;
    expect(material).not.toBeNull();

    await expect(
      dataSource.query('DELETE FROM "materials_catalog" WHERE "id" = $1', [
        material.id,
      ]),
    ).rejects.toThrow();
  });

  /**
   * `dominantWasteReference` (quote-coherence.ts) retient la fourchette que le
   * plus grand nombre de matériaux de l'ouvrage partagent. Réduire le jeu de
   * matériaux à 1-2 par ouvrage (E1-2) pourrait faire basculer ce vote — on
   * verrouille donc les verdicts sur les deux catégories qui ont une pose
   * (peinture, carrelage), un verdict visible par l'utilisateur.
   */
  describe('checkQuotePublic — fourchette dominante inchangée par E1-2', () => {
    it('peinture murale : 5–15 % en pose standard', async () => {
      const result = await service.checkQuotePublic({
        length_cm: 400,
        width_cm: 300,
        height_cm: 250,
        openings: [{ width_cm: 83, height_cm: 204, count: 1 }],
        work_type_code: 'wall_painting',
        declared_surface_m2: 33.31,
      } as PublicQuoteCheckRequestDto);

      expect(result.reference).toMatchObject({
        pose_type: 'standard',
        min_percent: 5,
        max_percent: 15,
        is_default: false,
      });
    });

    it('carrelage sol, pose droite : 5–15 %', async () => {
      const result = await service.checkQuotePublic({
        length_cm: 400,
        width_cm: 300,
        height_cm: 250,
        openings: [],
        work_type_code: 'floor_tiling',
        custom_params: { laying_pattern: 'straight', tile_format: '30x30' },
        declared_surface_m2: 12,
      } as PublicQuoteCheckRequestDto);

      expect(result.reference).toMatchObject({
        pose_type: 'straight',
        min_percent: 5,
        max_percent: 15,
        is_default: false,
      });
    });
  });
});
