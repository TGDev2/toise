import { DataSource } from 'typeorm';
import { migratedDataSource } from './test-database';
import { User } from '../../src/users/entities/user.entity';
import { Organization } from '../../src/organizations/entities/organization.entity';
import {
  Project,
  ProjectStatus,
  WorkType as ProjectWorkType,
} from '../../src/projects/entities/project.entity';
import { EstimationsService } from '../../src/estimations/estimations.service';
import { EstimationEngine } from '../../src/estimations/estimation-engine';
import { EstimationResult } from '../../src/estimations/entities/estimation-result.entity';
import { EmailCapture } from '../../src/estimations/entities/email-capture.entity';
import { ApiEstimateRequestDto } from '../../src/estimations/dto/api-estimate-request.dto';
import { LearnedWasteFactor } from '../../src/materials/entities/learned-waste-factor.entity';
import { WorkTypeMaterial } from '../../src/materials/entities/work-type-material.entity';
import { MaterialCatalog } from '../../src/materials/entities/material-catalog.entity';
import { MaterialEcoEquivalence } from '../../src/materials/entities/material-eco-equivalence.entity';
import { WorkType } from '../../src/projects/entities/work-type.entity';
import { ShoppingListsService } from '../../src/shopping-lists/shopping-lists.service';
import {
  ShoppingList,
  type ShoppingListData,
} from '../../src/shopping-lists/entities/shopping-list.entity';
import { ComplementaryMaterial } from '../../src/shopping-lists/entities/complementary-material.entity';
import type { ProjectsService } from '../../src/projects/projects.service';
import type { EmailService } from '../../src/email/email.service';
import type { AnalyticsService } from '../../src/analytics/analytics.service';
import type { LogbookService } from '../../src/logbook/logbook.service';

/**
 * E1-6 — la composition de la liste d'achat, de bout en bout : vraies
 * migrations, vrai catalogue curé, vrai moteur, vraie génération. C'est le seul
 * étage où le doublon était visible : il naissait de la rencontre entre deux
 * jeux de données (`materials_catalog` × `work_type_materials` d'un côté,
 * `complementary_materials` de l'autre), qu'aucune spec unitaire ne monte
 * ensemble.
 *
 * Chantier de référence : une pièce de 4 × 3 m, carrelage sol, pose droite,
 * niveau intermédiaire — 12 m² exactement.
 */

const SURFACE_M2 = 12;

/**
 * Ce qui colle un carreau. Le préfixe importe : « Peigne à colle 10mm » porte
 * le mot « colle » sans être une colle, et c'est justement un accessoire que la
 * liste contient.
 */
const ADHESIVE = /^(mortier-colle|colle )/i;

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

function buildShoppingListsService(
  dataSource: DataSource,
  estimation: EstimationResult,
): ShoppingListsService {
  return new ShoppingListsService(
    dataSource.getRepository(ShoppingList),
    dataSource.getRepository(ComplementaryMaterial),
    dataSource.getRepository(WorkType),
    dataSource.getRepository(MaterialCatalog),
    dataSource.getRepository(MaterialEcoEquivalence),
    {
      getLatest: () => Promise.resolve(estimation),
    } as unknown as EstimationsService,
    {
      findOneForOrg: () => Promise.resolve({ id: estimation.project_id }),
    } as unknown as ProjectsService,
    { track: () => undefined } as unknown as AnalyticsService,
    {} as LogbookService,
  );
}

describe("Liste d'achat carrelage sol (intégration, PostgreSQL réel)", () => {
  let dataSource: DataSource;
  let data: ShoppingListData;
  let estimationLines: EstimationResult['items_json'];

  beforeAll(async () => {
    dataSource = await migratedDataSource();

    const user = await dataSource.getRepository(User).save({
      email: 'int-tiling@chiffreo.test',
      firebase_uid: 'firebase-int-tiling',
    });
    const organization = await dataSource.getRepository(Organization).save({
      name: 'Org carrelage',
      owner_user_id: user.id,
      is_personal: true,
    });
    const project = await dataSource.getRepository(Project).save({
      user_id: user.id,
      organization_id: organization.id,
      name: 'Chantier carrelage',
      room_name: 'Cuisine',
      work_type: ProjectWorkType.TILING,
      status: ProjectStatus.DRAFT,
    });

    // Le moteur réel sur le catalogue réel : 4 × 3 m au sol = 12 m².
    const dto = {
      rooms: [
        {
          length_cm: 400,
          width_cm: 300,
          height_cm: 250,
          openings: [],
          work_items: [
            {
              work_type_code: 'floor_tiling',
              custom_params: {
                laying_pattern: 'straight',
                tile_format: '45x45',
              },
            },
          ],
        },
      ],
    } as unknown as ApiEstimateRequestDto;

    const computed =
      await buildEstimationsService(dataSource).estimatePublicMulti(dto);

    const estimation = await dataSource.getRepository(EstimationResult).save({
      project_id: project.id,
      skill_level: 'intermediate',
      items_json: computed.items,
      aggregated_json: computed.aggregated,
      total_items: computed.items.length,
    });

    const shoppingList = await buildShoppingListsService(
      dataSource,
      estimation,
    ).generate(project.id, organization.id, user.id);

    data = shoppingList.items_json;
    estimationLines = computed.items;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  /**
   * Pourquoi le contexte carrelage était faux : une ligne d'estimation est un
   * couple (ouvrage × matériau). Chacune porte les **mêmes** 12 m² ; les sommer
   * donnait autant de fois la surface qu'il y a de matériaux curés — 36 m² ici,
   * jusqu'à 48 × 12 avant E1-2. La colle et le joint se calculaient là-dessus.
   */
  it("chaque ligne d'estimation porte les mêmes 12 m² — les sommer les multiplie", () => {
    expect(estimationLines.length).toBeGreaterThan(1);
    for (const line of estimationLines) {
      expect(line.surface_m2).toBeCloseTo(SURFACE_M2, 6);
    }
  });

  /**
   * Le défaut d'origine : la colle sortait deux fois — une ligne matériau
   * (`Mortier-colle flexible (C2)`) et un complément calculé
   * (`Colle a carrelage`), dont la quantité était en prime multipliée par le
   * nombre de lignes d'estimation de la catégorie.
   */
  it("ne contient qu'une seule ligne de colle, tous blocs confondus", () => {
    const adhesives = [
      ...data.material_items.map((i) => i.material_name),
      ...data.complementary_items.map((i) => i.name),
    ].filter((name) => ADHESIVE.test(name));

    expect(adhesives).toEqual(['Mortier-colle flexible (C2)']);
  });

  it('achète une quantité de colle cohérente avec 12 m²', () => {
    const adhesive = data.material_items.find((i) =>
      ADHESIVE.test(i.material_name),
    )!;
    expect(adhesive).toBeDefined();

    // 12 / 0,14 m²·kg⁻¹ = 85,7 kg, + 10 % de perte (pose droite, niveau
    // intermédiaire) = 94,3 kg, soit 7,9 kg/m² : la consommation fiche d'un
    // mortier-colle sous du 45 × 45 au sol — 7 kg/m² en U9 double encollage
    // (Cermix CERMIFLEX, docs/SOURCES_CATALOGUE.md) — plus la perte.
    expect(adhesive.adjusted_qty / SURFACE_M2).toBeGreaterThanOrEqual(7);
    expect(adhesive.adjusted_qty / SURFACE_M2).toBeLessThanOrEqual(9);

    // Et ce qu'on met dans le caddie couvre ce besoin sans jamais dépasser d'un
    // conditionnement entier : 4 sacs de 25 kg pour 94,3 kg.
    const bought = adhesive.units_needed * adhesive.packaging_qty_per_unit;
    expect(bought).toBeGreaterThanOrEqual(adhesive.adjusted_qty);
    expect(bought - adhesive.adjusted_qty).toBeLessThan(
      adhesive.packaging_qty_per_unit,
    );
    expect(adhesive.units_needed).toBe(4);
    expect(adhesive.packaging_label).toBe('Sac 25 kg');
  });

  /**
   * L'arbitrage lui-même : ne survivent en complément que les produits qu'aucun
   * matériau curé ne couvre. Joint et croisillons suivaient la colle.
   */
  it('ne propose plus aucun complément que le catalogue chiffre déjà', () => {
    expect(data.complementary_items.map((i) => i.name)).toEqual([
      'Profil de finition',
    ]);
  });

  it('ne calcule plus aucune quantité de complément', () => {
    for (const item of data.complementary_items) {
      expect(item.is_calculated).toBeUndefined();
      expect(item.quantity).toBe(item.default_quantity);
    }
  });

  it('ne fait apparaître aucun produit deux fois', () => {
    const names = [
      ...data.material_items.map((i) => i.material_name),
      ...data.complementary_items.map((i) => i.name),
    ];

    expect(names).toHaveLength(new Set(names).size);
  });
});
