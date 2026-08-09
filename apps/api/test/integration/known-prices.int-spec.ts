import { DataSource } from 'typeorm';
import { migratedDataSource, truncateUserData } from './test-database';
import { User } from '../../src/users/entities/user.entity';
import {
  Project,
  ProjectStatus,
  WorkType as ProjectWorkType,
} from '../../src/projects/entities/project.entity';
import { ShoppingListsService } from '../../src/shopping-lists/shopping-lists.service';
import {
  ShoppingList,
  type ShoppingListData,
} from '../../src/shopping-lists/entities/shopping-list.entity';
import { ComplementaryMaterial } from '../../src/shopping-lists/entities/complementary-material.entity';
import { EstimationResult } from '../../src/estimations/entities/estimation-result.entity';
import { WorkType } from '../../src/projects/entities/work-type.entity';
import { MaterialCatalog } from '../../src/materials/entities/material-catalog.entity';
import { MaterialEcoEquivalence } from '../../src/materials/entities/material-eco-equivalence.entity';
import type { EstimationsService } from '../../src/estimations/estimations.service';
import type { ProjectsService } from '../../src/projects/projects.service';
import type { AnalyticsService } from '../../src/analytics/analytics.service';
import type { LogbookService } from '../../src/logbook/logbook.service';

/**
 * E4-4 — rappel du dernier prix relevé (`findKnownPrices`).
 *
 * Testé contre un vrai PostgreSQL parce que la mécanique **est** du SQL :
 * `DISTINCT ON` sur `jsonb_array_elements`, portée par organisation, exclusion
 * du chantier courant. Un dépôt mocké ne construit aucune requête et
 * n'attesterait de rien (leçon 8).
 */

const MATERIAL_A = '11111111-1111-4111-8111-111111111111';
const MATERIAL_B = '22222222-2222-4222-8222-222222222222';
const COMPLEMENT_A = '33333333-3333-4333-8333-333333333333';

function materialItem(
  materialId: string,
  realUnitPrice: number | null,
  storeName: string | null = null,
): ShoppingListData['material_items'][number] {
  return {
    material_id: materialId,
    work_type_code: 'wall_painting',
    work_type_label: 'Peinture murale',
    material_name: `Matériau ${materialId.slice(0, 4)}`,
    material_category: 'painting',
    material_unit: 'L',
    packaging_label: 'Pot 5 L',
    packaging_qty_per_unit: 5,
    adjusted_qty: 5,
    original_units_needed: 1,
    units_needed: 1,
    is_manually_adjusted: false,
    real_unit_price: realUnitPrice,
    store_name: storeName,
  };
}

function complementItem(
  complementId: string,
  realUnitPrice: number | null,
): ShoppingListData['complementary_items'][number] {
  return {
    complementary_material_id: complementId,
    name: 'Rouleau',
    description_fr: '',
    category: 'tool',
    unit_label: 'unité',
    default_quantity: 1,
    quantity: 1,
    is_removed: false,
    real_unit_price: realUnitPrice,
    store_name: null,
  };
}

function buildService(dataSource: DataSource): ShoppingListsService {
  return new ShoppingListsService(
    dataSource.getRepository(ShoppingList),
    dataSource.getRepository(ComplementaryMaterial),
    dataSource.getRepository(WorkType),
    dataSource.getRepository(MaterialCatalog),
    dataSource.getRepository(MaterialEcoEquivalence),
    {} as EstimationsService,
    { findOneForUser: () => Promise.resolve({}) } as unknown as ProjectsService,
    { track: () => undefined } as unknown as AnalyticsService,
    {} as LogbookService,
  );
}

describe('Rappel des prix déjà saisis (intégration, PostgreSQL réel)', () => {
  let dataSource: DataSource;
  let service: ShoppingListsService;

  beforeAll(async () => {
    dataSource = await migratedDataSource();
    service = buildService(dataSource);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await truncateUserData(dataSource);
  });

  async function seedAccount(suffix: string): Promise<{
    userId: string;
  }> {
    const user = await dataSource.getRepository(User).save({
      email: `int-known-prices-${suffix}@chiffreo.test`,
      firebase_uid: `firebase-known-prices-${suffix}`,
    });
    return { userId: user.id };
  }

  async function seedProject(userId: string, name: string): Promise<Project> {
    return dataSource.getRepository(Project).save({
      user_id: userId,
      name,
      room_name: 'Salon',
      work_type: ProjectWorkType.PAINTING,
      status: ProjectStatus.DRAFT,
    });
  }

  async function seedShoppingList(
    project: Project,
    data: ShoppingListData,
    updatedAt?: string,
  ): Promise<ShoppingList> {
    // `shopping_lists.estimation_id` porte une clé étrangère : la liste ne peut
    // pas exister sans l'estimation dont elle dérive.
    const estimation = await dataSource.getRepository(EstimationResult).save({
      project_id: project.id,
      skill_level: 'intermediate',
      items_json: [],
      total_items: 0,
    });
    const saved = await dataSource.getRepository(ShoppingList).save({
      project_id: project.id,
      estimation_id: estimation.id,
      items_json: data,
    });
    if (updatedAt) {
      // `@UpdateDateColumn` réécrit la valeur à chaque `save()` : forcer la date
      // en SQL est le seul moyen d'ordonner deux relevés de façon déterministe.
      await dataSource.query(
        'UPDATE shopping_lists SET updated_at = $1 WHERE id = $2',
        [updatedAt, saved.id],
      );
    }
    return saved;
  }

  it('rend le prix le plus récent par article, hors chantier courant', async () => {
    const { userId } = await seedAccount('recent');
    const oldProject = await seedProject(userId, 'Chantier 1');
    const recentProject = await seedProject(userId, 'Chantier 2');
    const currentProject = await seedProject(userId, 'En cours');

    await seedShoppingList(
      oldProject,
      {
        material_items: [materialItem(MATERIAL_A, 30, 'Castorama')],
        complementary_items: [],
      },
      '2026-01-10T09:00:00Z',
    );
    await seedShoppingList(
      recentProject,
      {
        material_items: [materialItem(MATERIAL_A, 45.9, 'Leroy Merlin')],
        complementary_items: [complementItem(COMPLEMENT_A, 7.5)],
      },
      '2026-06-12T09:00:00Z',
    );
    // Le chantier courant porte un prix : il ne doit jamais se rappeler à
    // lui-même, sinon le bouton proposerait de reprendre ce qu'on vient de
    // saisir.
    await seedShoppingList(currentProject, {
      material_items: [materialItem(MATERIAL_B, 99)],
      complementary_items: [],
    });

    const result = await service.findKnownPrices(currentProject.id, userId);

    expect(result.materials).toEqual([
      {
        item_id: MATERIAL_A,
        real_unit_price: 45.9,
        store_name: 'Leroy Merlin',
        recorded_on: '2026-06-12',
        project_name: 'Chantier 2',
      },
    ]);
    expect(result.complements).toEqual([
      {
        item_id: COMPLEMENT_A,
        real_unit_price: 7.5,
        store_name: null,
        recorded_on: '2026-06-12',
        project_name: 'Chantier 2',
      },
    ]);
  });

  it("ne franchit jamais la frontière d'une organisation", async () => {
    const mine = await seedAccount('mine');
    const other = await seedAccount('other');

    const theirProject = await seedProject(other.userId, 'Chantier voisin');
    await seedShoppingList(theirProject, {
      material_items: [materialItem(MATERIAL_A, 45.9, 'Leroy Merlin')],
      complementary_items: [],
    });

    const myProject = await seedProject(mine.userId, 'Mon chantier');
    const result = await service.findKnownPrices(myProject.id, mine.userId);

    expect(result.materials).toEqual([]);
    expect(result.complements).toEqual([]);
  });

  it('ignore les lignes sans prix, les prix nuls et les chantiers supprimés', async () => {
    const { userId } = await seedAccount('filters');
    const unpricedProject = await seedProject(userId, 'Sans prix');
    const deletedProject = await seedProject(userId, 'Supprimé');
    const currentProject = await seedProject(userId, 'En cours');

    await seedShoppingList(unpricedProject, {
      material_items: [
        materialItem(MATERIAL_A, null),
        materialItem(MATERIAL_B, 0),
      ],
      complementary_items: [],
    });
    await seedShoppingList(deletedProject, {
      material_items: [materialItem(MATERIAL_A, 45.9)],
      complementary_items: [],
    });
    await dataSource
      .getRepository(Project)
      .softDelete({ id: deletedProject.id });

    const result = await service.findKnownPrices(currentProject.id, userId);

    expect(result.materials).toEqual([]);
  });

  it("survit à une liste dont le bloc d'articles n'est pas un tableau", async () => {
    const { userId } = await seedAccount('malformed');
    const goodProject = await seedProject(userId, 'Bon chantier');
    const brokenProject = await seedProject(userId, 'Liste cassée');
    const currentProject = await seedProject(userId, 'En cours');

    await seedShoppingList(goodProject, {
      material_items: [materialItem(MATERIAL_A, 45.9)],
      complementary_items: [],
    });
    // `jsonb_array_elements` lève sur autre chose qu'un tableau : une seule
    // ligne malformée priverait toute l'organisation du rappel.
    await seedShoppingList(brokenProject, {
      material_items: [],
      complementary_items: [],
    });
    await dataSource.query(
      `UPDATE shopping_lists SET items_json = '{"material_items": null, "complementary_items": null}'::jsonb WHERE project_id = $1`,
      [brokenProject.id],
    );

    const result = await service.findKnownPrices(currentProject.id, userId);

    expect(result.materials).toHaveLength(1);
    expect(result.materials[0].item_id).toBe(MATERIAL_A);
  });
});
