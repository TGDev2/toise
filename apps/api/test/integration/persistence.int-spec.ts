import { DataSource } from 'typeorm';
import type Stripe from 'stripe';
import { migratedDataSource, truncateUserData } from './test-database';
import { User } from '../../src/users/entities/user.entity';
import { Organization } from '../../src/organizations/entities/organization.entity';
import {
  Project,
  ProjectStatus,
  WorkType as ProjectWorkType,
} from '../../src/projects/entities/project.entity';
import { Room } from '../../src/projects/entities/room.entity';
import { RoomDimensions } from '../../src/projects/entities/room-dimensions.entity';
import {
  Opening,
  OpeningType,
} from '../../src/projects/entities/opening.entity';
import { ProjectPhoto } from '../../src/photos/entities/project-photo.entity';
import { EstimationResult } from '../../src/estimations/entities/estimation-result.entity';
import {
  ShoppingList,
  type ShoppingListMaterialItem,
} from '../../src/shopping-lists/entities/shopping-list.entity';
import { ComplementaryMaterial } from '../../src/shopping-lists/entities/complementary-material.entity';
import { WorkType } from '../../src/projects/entities/work-type.entity';
import { MaterialCatalog } from '../../src/materials/entities/material-catalog.entity';
import { MaterialEcoEquivalence } from '../../src/materials/entities/material-eco-equivalence.entity';
import { ShoppingListsService } from '../../src/shopping-lists/shopping-lists.service';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';
import { Subscription } from '../../src/subscriptions/entities/subscription.entity';
import { StripeEvent } from '../../src/subscriptions/entities/stripe-event.entity';
import type { EstimationsService } from '../../src/estimations/estimations.service';
import type { ProjectsService } from '../../src/projects/projects.service';
import type { AnalyticsService } from '../../src/analytics/analytics.service';
import type { LogbookService } from '../../src/logbook/logbook.service';
import type { ReferralsService } from '../../src/referrals/referrals.service';
import type { UsersService } from '../../src/users/users.service';
import type { ConfigService } from '@nestjs/config';

/**
 * Les comportements que les `*.e2e-spec.ts` ne peuvent pas atteindre, faute de
 * base : ce sont PostgreSQL et lui seul qui décide de ce qu'une suppression
 * emporte, de ce qu'une contrainte d'unicité refuse, et de ce que deux écritures
 * simultanées produisent.
 */

const PEINTURE = '11111111-1111-4111-8111-111111111111';
const ENDUIT = '22222222-2222-4222-8222-222222222222';

function materialItem(
  materialId: string,
  name: string,
): ShoppingListMaterialItem {
  return {
    material_id: materialId,
    work_type_code: 'painting_walls',
    work_type_label: 'Peinture murs',
    material_name: name,
    material_category: 'painting',
    material_unit: 'L',
    packaging_label: 'Pot 3L',
    packaging_qty_per_unit: 3,
    adjusted_qty: 3.96,
    original_units_needed: 2,
    units_needed: 2,
    is_manually_adjusted: false,
  };
}

interface Fixture {
  userId: string;
  organizationId: string;
  projectId: string;
  roomId: string;
  estimationId: string;
}

/** Un projet complet : utilisateur → organisation → projet → pièce → dérivés. */
async function seedProject(
  dataSource: DataSource,
  suffix: string,
): Promise<Fixture> {
  const user = await dataSource.getRepository(User).save({
    email: `int-${suffix}@chiffreo.test`,
    firebase_uid: `firebase-int-${suffix}`,
  });
  const organization = await dataSource.getRepository(Organization).save({
    name: `Org ${suffix}`,
    owner_user_id: user.id,
    is_personal: true,
  });
  const project = await dataSource.getRepository(Project).save({
    user_id: user.id,
    organization_id: organization.id,
    name: `Chantier ${suffix}`,
    room_name: 'Salon',
    work_type: ProjectWorkType.PAINTING,
    status: ProjectStatus.DRAFT,
  });
  const room = await dataSource.getRepository(Room).save({
    project_id: project.id,
    name: 'Salon',
    sort_order: 0,
  });
  await dataSource.getRepository(RoomDimensions).save({
    room_id: room.id,
    length_cm: 400,
    width_cm: 300,
    height_cm: 250,
  });
  await dataSource.getRepository(Opening).save({
    room_id: room.id,
    type: OpeningType.DOOR,
    width_cm: 90,
    height_cm: 204,
    count: 1,
  });
  await dataSource.getRepository(ProjectPhoto).save({
    project_id: project.id,
    storage_url: `${project.id}/photo.heic`,
    original_filename: 'IMG_0001.heic',
    mime_type: 'image/heic',
    size_bytes: 2_400_000,
  });
  const estimation = await dataSource.getRepository(EstimationResult).save({
    project_id: project.id,
    skill_level: 'intermediate',
    items_json: [],
    total_items: 0,
  });
  await dataSource.getRepository(ShoppingList).save({
    project_id: project.id,
    estimation_id: estimation.id,
    items_json: {
      material_items: [
        materialItem(PEINTURE, 'Peinture acrylique'),
        materialItem(ENDUIT, 'Enduit de rebouchage'),
      ],
      complementary_items: [],
    },
  });

  return {
    userId: user.id,
    organizationId: organization.id,
    projectId: project.id,
    roomId: room.id,
    estimationId: estimation.id,
  };
}

async function countWhere(
  dataSource: DataSource,
  table: string,
  column: string,
  value: string,
): Promise<number> {
  const rows: { count: string }[] = await dataSource.query(
    `SELECT COUNT(*)::text AS count FROM "${table}" WHERE "${column}" = $1`,
    [value],
  );
  return parseInt(rows[0].count, 10);
}

describe('Persistance (intégration, PostgreSQL réel)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await migratedDataSource();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await truncateUserData(dataSource);
  });

  describe('Cascades de suppression', () => {
    it("efface tout ce qui dépend d'un projet supprimé, et rien de plus", async () => {
      const mine = await seedProject(dataSource, 'cascade-a');
      const other = await seedProject(dataSource, 'cascade-b');

      await dataSource.query('DELETE FROM projects WHERE id = $1', [
        mine.projectId,
      ]);

      expect(
        await countWhere(dataSource, 'rooms', 'project_id', mine.projectId),
      ).toBe(0);
      expect(
        await countWhere(dataSource, 'room_dimensions', 'room_id', mine.roomId),
      ).toBe(0);
      expect(
        await countWhere(dataSource, 'openings', 'room_id', mine.roomId),
      ).toBe(0);
      expect(
        await countWhere(
          dataSource,
          'project_photos',
          'project_id',
          mine.projectId,
        ),
      ).toBe(0);
      expect(
        await countWhere(
          dataSource,
          'estimation_results',
          'project_id',
          mine.projectId,
        ),
      ).toBe(0);
      expect(
        await countWhere(
          dataSource,
          'shopping_lists',
          'project_id',
          mine.projectId,
        ),
      ).toBe(0);

      // Volet « destructrice » : la cascade ne doit pas déborder sur un projet
      // voisin, ni sur l'utilisateur/l'organisation qui restent propriétaires.
      expect(
        await countWhere(dataSource, 'rooms', 'project_id', other.projectId),
      ).toBe(1);
      expect(await countWhere(dataSource, 'users', 'id', mine.userId)).toBe(1);
      expect(
        await countWhere(
          dataSource,
          'organizations',
          'id',
          mine.organizationId,
        ),
      ).toBe(1);
    });

    it("refuse d'effacer un utilisateur qui possède encore une organisation", async () => {
      const mine = await seedProject(dataSource, 'user-a');

      // `FK_organizations_owner` est passé en RESTRICT : la suppression nue
      // n'est plus un chemin praticable, c'est le service de suppression de
      // compte qui doit démonter l'organisation en premier.
      await expect(
        dataSource.query('DELETE FROM users WHERE id = $1', [mine.userId]),
      ).rejects.toThrow(/FK_organizations_owner/);

      // Le refus est total : rien n'a été effacé au passage.
      expect(await countWhere(dataSource, 'users', 'id', mine.userId)).toBe(1);
      expect(
        await countWhere(dataSource, 'projects', 'id', mine.projectId),
      ).toBe(1);
    });

    it("efface les projets d'un utilisateur avec son organisation, sans toucher aux autres", async () => {
      const mine = await seedProject(dataSource, 'user-a');
      const other = await seedProject(dataSource, 'user-b');

      await dataSource.query('DELETE FROM organizations WHERE id = $1', [
        mine.organizationId,
      ]);
      await dataSource.query('DELETE FROM users WHERE id = $1', [mine.userId]);

      expect(
        await countWhere(dataSource, 'projects', 'id', mine.projectId),
      ).toBe(0);
      expect(
        await countWhere(dataSource, 'rooms', 'project_id', mine.projectId),
      ).toBe(0);

      expect(
        await countWhere(dataSource, 'projects', 'id', other.projectId),
      ).toBe(1);
      expect(
        await countWhere(dataSource, 'rooms', 'project_id', other.projectId),
      ).toBe(1);
    });
  });

  describe('Idempotence des webhooks Stripe', () => {
    /**
     * `claimWebhookEvent` repose sur un `INSERT … ON CONFLICT DO NOTHING` :
     * sa correction tient **entièrement** à la clé primaire sur `event_id`.
     * Mocké, il renvoie toujours ce qu'on lui fait renvoyer.
     */
    function buildService(): SubscriptionsService {
      return new SubscriptionsService(
        dataSource.getRepository(Subscription),
        dataSource.getRepository(StripeEvent),
        {} as UsersService,
        {} as AnalyticsService,
        {} as ReferralsService,
        { get: () => undefined } as unknown as ConfigService,
      );
    }

    const event = (id: string) =>
      ({ id, type: 'invoice.paid' }) as unknown as Stripe.Event;

    it('ne réserve un event rejoué par Stripe qu’une seule fois', async () => {
      const service = buildService();

      expect(await service.claimWebhookEvent(event('evt_replay'))).toBe(true);
      expect(await service.claimWebhookEvent(event('evt_replay'))).toBe(false);
    });

    it('ne laisse passer qu’un seul gagnant sur deux livraisons simultanées', async () => {
      const service = buildService();

      const claims = await Promise.all([
        service.claimWebhookEvent(event('evt_race')),
        service.claimWebhookEvent(event('evt_race')),
      ]);

      expect(claims.filter(Boolean)).toHaveLength(1);
    });

    it('rend un event rejouable après un échec de traitement', async () => {
      const service = buildService();

      await service.claimWebhookEvent(event('evt_failed'));
      await service.releaseWebhookEvent('evt_failed');

      expect(await service.claimWebhookEvent(event('evt_failed'))).toBe(true);
    });
  });

  describe('Écritures concurrentes sur un blob JSONB', () => {
    function buildService(fixture: Fixture): ShoppingListsService {
      return new ShoppingListsService(
        dataSource.getRepository(ShoppingList),
        dataSource.getRepository(ComplementaryMaterial),
        dataSource.getRepository(WorkType),
        dataSource.getRepository(MaterialCatalog),
        dataSource.getRepository(MaterialEcoEquivalence),
        {
          getLatest: () => Promise.resolve({ id: fixture.estimationId }),
        } as unknown as EstimationsService,
        {
          findOneForOrg: () => Promise.resolve({ id: fixture.projectId }),
        } as unknown as ProjectsService,
        {} as AnalyticsService,
        {} as LogbookService,
      );
    }

    /**
     * Deux artisans sur le même chantier ajustent deux lignes différentes de la
     * même liste. `items_json` étant une seule colonne, un simple
     * lecture-modification-écriture fait gagner le dernier écrivain : la
     * correction de l'autre disparaît sans erreur ni trace.
     */
    it('conserve les deux corrections faites en parallèle sur des lignes différentes', async () => {
      const fixture = await seedProject(dataSource, 'concurrency');
      const service = buildService(fixture);

      await Promise.all([
        service.update(fixture.projectId, fixture.organizationId, {
          material_items: [{ material_id: PEINTURE, units_needed: 7 }],
        }),
        service.update(fixture.projectId, fixture.organizationId, {
          material_items: [{ material_id: ENDUIT, units_needed: 9 }],
        }),
      ]);

      const stored = await dataSource
        .getRepository(ShoppingList)
        .findOneByOrFail({ project_id: fixture.projectId });
      const units = Object.fromEntries(
        stored.items_json.material_items.map((item) => [
          item.material_id,
          item.units_needed,
        ]),
      );

      expect(units[PEINTURE]).toBe(7);
      expect(units[ENDUIT]).toBe(9);
    });
  });
});
