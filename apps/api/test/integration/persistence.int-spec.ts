import { DataSource } from 'typeorm';
import type Stripe from 'stripe';
import { migratedDataSource, truncateUserData } from './test-database';
import { User } from '../../src/users/entities/user.entity';
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
import {
  Subscription,
  SubscriptionStatus,
} from '../../src/subscriptions/entities/subscription.entity';
import { StripeEvent } from '../../src/subscriptions/entities/stripe-event.entity';
import { SubscriptionRefund } from '../../src/subscriptions/entities/subscription-refund.entity';
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
    email: `int-${suffix}@toise.test`,
    firebase_uid: `firebase-int-${suffix}`,
  });
  const project = await dataSource.getRepository(Project).save({
    user_id: user.id,
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
      // voisin, ni sur l'utilisateur qui reste propriétaire.
      expect(
        await countWhere(dataSource, 'rooms', 'project_id', other.projectId),
      ).toBe(1);
      expect(await countWhere(dataSource, 'users', 'id', mine.userId)).toBe(1);
    });

    it("efface les projets d'un utilisateur avec lui, sans toucher aux autres", async () => {
      const mine = await seedProject(dataSource, 'user-a');
      const other = await seedProject(dataSource, 'user-b');

      // Avant E4-1, ce `DELETE` échouait sur `FK_organizations_owner`, passée en
      // `RESTRICT` par la migration 1711468800061 pour qu'une suppression de
      // compte individuelle ne détruise pas les données d'une organisation
      // partagée. Sans organisation, il n'y a plus de donnée collective à
      // protéger : `FK_projects_user` est en `CASCADE` et la suppression du
      // compte emporte ses propres lignes, et elles seules.
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
        dataSource.getRepository(SubscriptionRefund),
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

    /**
     * Le scénario que la réservation seule ne couvrait pas : le processus meurt
     * entre `claimWebhookEvent` et la fin du traitement. Aucun `catch` ne
     * s'exécute, donc rien n'est libéré — l'event doit malgré tout redevenir
     * reprenable, sans quoi l'abonnement reste désynchronisé pour de bon.
     */
    it('reprend une réservation abandonnée par un processus mort', async () => {
      const service = buildService();

      expect(await service.claimWebhookEvent(event('evt_orphan'))).toBe(true);
      // Fraîche : une autre livraison en vol ne doit pas doubler le traitement.
      expect(await service.claimWebhookEvent(event('evt_orphan'))).toBe(false);

      await dataSource.query(
        `UPDATE stripe_events SET claimed_at = now() - interval '1 hour' WHERE event_id = $1`,
        ['evt_orphan'],
      );

      expect(await service.claimWebhookEvent(event('evt_orphan'))).toBe(true);
    });

    it('ne reprend jamais un event dont le traitement a abouti', async () => {
      const service = buildService();

      await service.claimWebhookEvent(event('evt_done'));
      await service.markWebhookEventProcessed('evt_done');

      // Même vieille, une réservation menée à terme reste close : c'est
      // l'idempotence pour laquelle la table existe.
      await dataSource.query(
        `UPDATE stripe_events SET claimed_at = now() - interval '1 hour' WHERE event_id = $1`,
        ['evt_done'],
      );

      expect(await service.claimWebhookEvent(event('evt_done'))).toBe(false);
    });
  });

  /**
   * Ordre de livraison des webhooks Stripe.
   *
   * Stripe garantit la livraison, jamais l'ordre. Les handlers appliquaient le
   * dernier événement **arrivé** : une résiliation doublée par un
   * `customer.subscription.updated` émis avant elle mais livré après rendait à
   * l'abonné un palier qu'il ne payait plus, définitivement — aucun événement
   * ultérieur ne venant corriger l'état.
   *
   * La garde vit dans le `WHERE` d'un UPDATE conditionnel : mockée, elle
   * renvoie ce qu'on lui fait renvoyer. Seul PostgreSQL peut dire si elle
   * écarte réellement l'écriture périmée, et si elle laisse passer le reste.
   */
  describe('Ordre de livraison des webhooks Stripe', () => {
    const PRICE_ARTISAN = 'price_artisan_279_an';
    /**
     * Un prix qui ne résout **aucun** palier : celui d'une offre retirée du
     * catalogue. Il n'y a plus qu'un palier payant depuis E3-3, donc plus deux
     * paliers à faire permuter — ce que l'événement périmé doit être empêché
     * d'écraser se lit désormais sur les colonnes (`stripe_price_id`,
     * `last_stripe_event_at`) et sur le **nombre** d'écritures de palier.
     */
    const PRICE_RETIRED = 'price_retire_29_mois';

    const YEAR_SECONDS = 365 * 24 * 60 * 60;

    /** Émission chez Stripe : T1 précède T2 d'une minute. */
    const T1 = 1_700_000_000;
    const T2 = T1 + 60;

    const CONFIG: Record<string, string> = {
      'stripe.contractorEssentielPriceId': PRICE_ARTISAN,
    };

    /** Paliers successivement écrits sur l'utilisateur, dans l'ordre. */
    let tiersWritten: string[];

    function buildService(): SubscriptionsService {
      tiersWritten = [];
      return new SubscriptionsService(
        dataSource.getRepository(Subscription),
        dataSource.getRepository(StripeEvent),
        dataSource.getRepository(SubscriptionRefund),
        {
          updateSubscriptionTier: (_userId: string, tier: string) => {
            tiersWritten.push(tier);
            return Promise.resolve();
          },
        } as unknown as UsersService,
        { track: () => undefined } as unknown as AnalyticsService,
        {} as ReferralsService,
        {
          get: (key: string) => CONFIG[key],
        } as unknown as ConfigService,
      );
    }

    async function seedSubscription(suffix: string): Promise<Subscription> {
      const user = await dataSource.getRepository(User).save({
        email: `sub-${suffix}@toise.test`,
        firebase_uid: `firebase-sub-${suffix}`,
      });
      return dataSource.getRepository(Subscription).save({
        user_id: user.id,
        stripe_customer_id: `cus_${suffix}`,
        stripe_subscription_id: `sub_${suffix}`,
        stripe_price_id: PRICE_ARTISAN,
        status: SubscriptionStatus.ACTIVE,
        cancel_at_period_end: false,
      });
    }

    function updatedEvent(
      stripeSubscriptionId: string,
      created: number,
      priceId: string,
    ) {
      return {
        id: `evt_upd_${created}`,
        type: 'customer.subscription.updated',
        created,
        data: {
          object: {
            id: stripeSubscriptionId,
            status: 'active',
            cancel_at_period_end: false,
            trial_end: null,
            items: {
              data: [
                {
                  price: { id: priceId },
                  current_period_start: created,
                  // Un an, et non trente jours : la garde d'ordonnancement ne
                  // dépend pas de la durée de la période, mais la fixture doit
                  // décrire l'offre réellement vendue (E3-3).
                  current_period_end: created + YEAR_SECONDS,
                },
              ],
            },
          },
        },
      } as unknown as Stripe.Event;
    }

    function deletedEvent(stripeSubscriptionId: string, created: number) {
      return {
        id: `evt_del_${created}`,
        type: 'customer.subscription.deleted',
        created,
        data: { object: { id: stripeSubscriptionId, status: 'canceled' } },
      } as unknown as Stripe.Event;
    }

    async function reload(id: string): Promise<Subscription> {
      return dataSource
        .getRepository(Subscription)
        .findOneOrFail({ where: { id } });
    }

    it("n'accepte pas un événement émis avant le dernier déjà appliqué", async () => {
      const service = buildService();
      const row = await seedSubscription('stale');

      // Résiliation (T2), puis l'événement retardé (T1) arrive après elle.
      await service.handleWebhookEvent(deletedEvent('sub_stale', T2));
      await service.handleWebhookEvent(
        updatedEvent('sub_stale', T1, PRICE_ARTISAN),
      );

      const persisted = await reload(row.id);
      expect(persisted.status).toBe(SubscriptionStatus.CANCELED);
      // Le symptôme exact du défaut : un palier payant rendu à un compte
      // résilié. `free` doit être le dernier mot.
      expect(tiersWritten).toEqual(['free']);
    });

    it('accepte les deux mêmes événements livrés dans l’ordre (témoin)', async () => {
      const service = buildService();
      const row = await seedSubscription('ordered');

      await service.handleWebhookEvent(
        updatedEvent('sub_ordered', T1, PRICE_ARTISAN),
      );
      await service.handleWebhookEvent(deletedEvent('sub_ordered', T2));

      // Sans ce témoin, une garde qui refuserait tout passerait le test
      // précédent : ici les deux écritures doivent avoir eu lieu.
      const persisted = await reload(row.id);
      expect(persisted.status).toBe(SubscriptionStatus.CANCELED);
      expect(tiersWritten).toEqual(['contractor_essentiel', 'free']);
    });

    it('ne laisse pas un instantané périmé écraser le prix courant', async () => {
      const service = buildService();
      const row = await seedSubscription('downgrade');

      // `customer.subscription.updated` porte un instantané **complet** de
      // l'abonnement, prix compris : livré en retard, il réécrivait le tout
      // puis re-synchronisait le palier. C'est par là qu'un palier périmé
      // revenait.
      //
      // Le couple de prix était artisan → Pro, puis artisan → Standard ; les
      // deux paliers ont quitté l'offre (E3-1 puis E3-3). Le prix périmé est
      // donc désormais celui d'une offre retirée, et la garde se constate sur
      // trois choses : le prix conservé, le filigrane, et le fait qu'**une
      // seule** écriture de palier ait eu lieu. Sans la garde, l'événement
      // périmé en déclencherait une seconde.
      await service.handleWebhookEvent(
        updatedEvent('sub_downgrade', T2, PRICE_ARTISAN),
      );
      await service.handleWebhookEvent(
        updatedEvent('sub_downgrade', T1, PRICE_RETIRED),
      );

      const persisted = await reload(row.id);
      expect(persisted.stripe_price_id).toBe(PRICE_ARTISAN);
      expect(persisted.last_stripe_event_at).toEqual(new Date(T2 * 1000));
      expect(tiersWritten).toEqual(['contractor_essentiel']);
    });

    /**
     * Le cycle est annuel depuis E3-3, et la période traverse le webhook comme
     * n'importe quelle autre : elle est lue sur l'**item** d'abonnement, pas
     * sur l'abonnement (le champ y a été déplacé par une version d'API). Ce
     * test le constate sur la vraie colonne plutôt que sur un mock.
     */
    it('persiste une période d’un an telle que Stripe la rend', async () => {
      const service = buildService();
      const row = await seedSubscription('annuel');

      await service.handleWebhookEvent(
        updatedEvent('sub_annuel', T2, PRICE_ARTISAN),
      );

      const persisted = await reload(row.id);
      const spanDays = Math.round(
        (persisted.current_period_end!.getTime() -
          persisted.current_period_start!.getTime()) /
          86_400_000,
      );
      expect(spanDays).toBe(365);
    });

    it('applique le premier événement d’une ligne sans filigrane', async () => {
      const service = buildService();
      const row = await seedSubscription('virgin');

      // Les lignes antérieures à la migration 1711468800076 ont
      // `last_stripe_event_at` à NULL : la garde ne doit rien y écarter.
      expect((await reload(row.id)).last_stripe_event_at).toBeNull();

      await service.handleWebhookEvent(
        updatedEvent('sub_virgin', T1, PRICE_ARTISAN),
      );

      expect((await reload(row.id)).last_stripe_event_at).toEqual(
        new Date(T1 * 1000),
      );
      expect(tiersWritten).toEqual(['contractor_essentiel']);
    });
  });

  /**
   * Délai de grâce sur impayé (E5-2).
   *
   * L'horodatage de départ du délai est posé par un `COALESCE` à l'intérieur du
   * `SET` de l'UPDATE conditionnel. Mocké, il rend ce qu'on lui fait rendre :
   * seul PostgreSQL peut dire si la date de la **première** entrée en
   * `past_due` survit aux relances suivantes — le point sur lequel tout le
   * dispositif repose, puisque Stripe rejoue `invoice.payment_failed` une bonne
   * dizaine de fois sur trois semaines.
   */
  describe('Délai de grâce sur impayé', () => {
    const PRICE_ARTISAN = 'price_artisan_19';

    /** Trois relances Stripe : T0, puis J+3, puis J+7. */
    const T0 = 1_700_000_000;
    const T0_PLUS_3D = T0 + 3 * 86_400;
    const T0_PLUS_7D = T0 + 7 * 86_400;

    const CONFIG: Record<string, string | number> = {
      'stripe.contractorEssentielPriceId': PRICE_ARTISAN,
      'stripe.pastDueGraceDays': 14,
    };

    let tiersWritten: string[];
    let downgraded: string[];

    function buildService(): SubscriptionsService {
      tiersWritten = [];
      downgraded = [];
      return new SubscriptionsService(
        dataSource.getRepository(Subscription),
        dataSource.getRepository(StripeEvent),
        dataSource.getRepository(SubscriptionRefund),
        {
          updateSubscriptionTier: (_userId: string, tier: string) => {
            tiersWritten.push(tier);
            return Promise.resolve();
          },
          downgradeToFreeIfNeeded: (userId: string) => {
            downgraded.push(userId);
            return Promise.resolve(true);
          },
        } as unknown as UsersService,
        { track: () => undefined } as unknown as AnalyticsService,
        {} as ReferralsService,
        {
          get: (key: string) => CONFIG[key],
        } as unknown as ConfigService,
      );
    }

    async function seed(
      suffix: string,
      overrides: Partial<Subscription> = {},
    ): Promise<Subscription> {
      const user = await dataSource.getRepository(User).save({
        email: `grace-${suffix}@toise.test`,
        firebase_uid: `firebase-grace-${suffix}`,
      });
      return dataSource.getRepository(Subscription).save({
        user_id: user.id,
        stripe_customer_id: `cus_grace_${suffix}`,
        stripe_subscription_id: `sub_grace_${suffix}`,
        stripe_price_id: PRICE_ARTISAN,
        status: SubscriptionStatus.ACTIVE,
        cancel_at_period_end: false,
        ...overrides,
      });
    }

    function paymentFailedEvent(stripeSubscriptionId: string, created: number) {
      return {
        id: `evt_fail_${stripeSubscriptionId}_${created}`,
        type: 'invoice.payment_failed',
        created,
        data: {
          object: {
            parent: {
              subscription_details: { subscription: stripeSubscriptionId },
            },
          },
        },
      } as unknown as Stripe.Event;
    }

    /**
     * `customer.subscription.updated` portant `active` — le chemin de reprise
     * qui n'a pas besoin d'appeler Stripe (le service est construit ici sans
     * clé secrète, `invoice.paid` irait chercher l'abonnement à distance).
     */
    function reactivatedEvent(stripeSubscriptionId: string, created: number) {
      return {
        id: `evt_ok_${stripeSubscriptionId}_${created}`,
        type: 'customer.subscription.updated',
        created,
        data: {
          object: {
            id: stripeSubscriptionId,
            status: 'active',
            cancel_at_period_end: false,
            trial_end: null,
            items: {
              data: [
                {
                  price: { id: PRICE_ARTISAN },
                  current_period_start: created,
                  current_period_end: created + 2_592_000,
                },
              ],
            },
          },
        },
      } as unknown as Stripe.Event;
    }

    async function reload(id: string): Promise<Subscription> {
      return dataSource
        .getRepository(Subscription)
        .findOneOrFail({ where: { id } });
    }

    it('ne redémarre pas le compte à rebours à chaque relance', async () => {
      const service = buildService();
      const row = await seed('retries');

      await service.handleWebhookEvent(
        paymentFailedEvent('sub_grace_retries', T0),
      );
      await service.handleWebhookEvent(
        paymentFailedEvent('sub_grace_retries', T0_PLUS_3D),
      );
      await service.handleWebhookEvent(
        paymentFailedEvent('sub_grace_retries', T0_PLUS_7D),
      );

      const persisted = await reload(row.id);
      expect(persisted.status).toBe(SubscriptionStatus.PAST_DUE);
      // Le défaut que le COALESCE existe pour empêcher : sans lui,
      // `past_due_since` vaudrait T0+7j et l'échéance aurait reculé d'une
      // semaine — indéfiniment, relance après relance.
      expect(persisted.past_due_since).toEqual(new Date(T0 * 1000));
      // Le filigrane, lui, suit bien le dernier événement émis.
      expect(persisted.last_stripe_event_at).toEqual(
        new Date(T0_PLUS_7D * 1000),
      );
    });

    it("n'horodate pas la grâce depuis un événement périmé", async () => {
      const service = buildService();
      const row = await seed('stale-grace');

      // Impayé (T0), régularisation (T0+7j), puis un événement émis à T0+3j
      // arrive en retard : il porte encore `past_due`.
      await service.handleWebhookEvent(
        paymentFailedEvent('sub_grace_stale-grace', T0),
      );
      await service.handleWebhookEvent(
        reactivatedEvent('sub_grace_stale-grace', T0_PLUS_7D),
      );
      await service.handleWebhookEvent(
        paymentFailedEvent('sub_grace_stale-grace', T0_PLUS_3D),
      );

      const persisted = await reload(row.id);
      expect(persisted.status).toBe(SubscriptionStatus.ACTIVE);
      // Le horodater ici ne casserait rien tout de suite — le balayage ne
      // regarde que les lignes `past_due`. Le dégât surviendrait des semaines
      // plus tard : le prochain impayé démarrerait avec un délai déjà consommé
      // et déclasserait l'abonné sur-le-champ.
      expect(persisted.past_due_since).toBeNull();
    });

    it("repose l'horodatage au prochain impayé après une régularisation", async () => {
      const service = buildService();
      const row = await seed('episode');

      await service.handleWebhookEvent(
        paymentFailedEvent('sub_grace_episode', T0),
      );
      await service.handleWebhookEvent(
        reactivatedEvent('sub_grace_episode', T0_PLUS_3D),
      );
      await service.handleWebhookEvent(
        paymentFailedEvent('sub_grace_episode', T0_PLUS_7D),
      );

      // Le compte à rebours est par épisode, pas par vie de l'abonnement :
      // un client qui a régularisé en mars a droit à un délai plein en juin.
      expect((await reload(row.id)).past_due_since).toEqual(
        new Date(T0_PLUS_7D * 1000),
      );
    });

    it('déclasse au balayage sans altérer la ligne d’abonnement', async () => {
      const service = buildService();
      const pastDueSince = new Date(Date.now() - 20 * 86_400_000);
      const row = await seed('sweep', {
        status: SubscriptionStatus.PAST_DUE,
        past_due_since: pastDueSince,
        last_stripe_event_at: new Date(T0 * 1000),
      });

      await service.sweepExpiredGracePeriods();

      expect(downgraded).toEqual([row.user_id]);

      // L'invariant qui rend la reprise gratuite : la ligne reste telle
      // quelle, donc un paiement ultérieur la remet en `active` et resynchronise
      // le palier par le chemin normal, sans code de réactivation dédié.
      const persisted = await reload(row.id);
      expect(persisted.status).toBe(SubscriptionStatus.PAST_DUE);
      expect(persisted.past_due_since).toEqual(pastDueSince);
      expect(persisted.last_stripe_event_at).toEqual(new Date(T0 * 1000));
    });

    it('épargne un impayé encore dans les temps (témoin)', async () => {
      const service = buildService();
      await seed('sweep-fresh', {
        status: SubscriptionStatus.PAST_DUE,
        past_due_since: new Date(Date.now() - 2 * 86_400_000),
      });

      await service.sweepExpiredGracePeriods();

      // Sans ce témoin, un balayage qui déclasserait tous les `past_due`
      // passerait le test précédent.
      expect(downgraded).toEqual([]);
    });
  });

  describe('Écritures concurrentes sur un blob JSONB', () => {
    function buildService(
      fixture: Fixture,
      estimationItems: unknown[] = [],
    ): ShoppingListsService {
      return new ShoppingListsService(
        dataSource.getRepository(ShoppingList),
        dataSource.getRepository(ComplementaryMaterial),
        dataSource.getRepository(WorkType),
        dataSource.getRepository(MaterialCatalog),
        dataSource.getRepository(MaterialEcoEquivalence),
        {
          getLatest: () =>
            Promise.resolve({
              id: fixture.estimationId,
              items_json: estimationItems,
              aggregated_json: null,
            }),
        } as unknown as EstimationsService,
        {
          findOneForUser: () => Promise.resolve({ id: fixture.projectId }),
        } as unknown as ProjectsService,
        { track: () => undefined } as unknown as AnalyticsService,
        {} as LogbookService,
      );
    }

    /** Ligne d'estimation minimale, telle que `generate` la consomme. */
    function estimationLine(materialId: string, name: string) {
      return {
        work_item_id: `wi-${materialId}`,
        work_type_code: 'painting_walls',
        work_type_label: 'Peinture murs',
        material_id: materialId,
        material_name: name,
        material_unit: 'L',
        surface_m2: 12,
        theoretical_qty: 3.6,
        adjusted_qty: 3.96,
        packaging_label: 'Pot 3L',
        packaging_qty_per_unit: 3,
        units_needed: 2,
      };
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
        service.update(fixture.projectId, fixture.userId, {
          material_items: [{ material_id: PEINTURE, units_needed: 7 }],
        }),
        service.update(fixture.projectId, fixture.userId, {
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

    /**
     * La régénération détruisait la ligne puis en insérait une autre. Le verrou
     * de `update()` portait donc sur une ligne condamnée : il ne protégeait
     * rien, et le `PATCH` concurrent finissait sur un 404 ou dans le vide.
     * Écrite en place, la liste garde son identité — les deux chemins prennent
     * le même verrou et se sérialisent.
     */
    it('sérialise une régénération et une correction concurrentes', async () => {
      const fixture = await seedProject(dataSource, 'regen-race');
      const service = buildService(fixture, [
        estimationLine(PEINTURE, 'Peinture acrylique'),
        estimationLine(ENDUIT, 'Enduit de rebouchage'),
      ]);
      const repo = dataSource.getRepository(ShoppingList);
      const before = await repo.findOneByOrFail({
        project_id: fixture.projectId,
      });

      await Promise.all([
        service.regenerate(fixture.projectId, fixture.userId),
        service.update(fixture.projectId, fixture.userId, {
          material_items: [
            { material_id: PEINTURE, units_needed: 4, real_unit_price: 31.5 },
          ],
        }),
      ]);

      const after = await repo.findOneByOrFail({
        project_id: fixture.projectId,
      });

      // Une seule ligne, la même qu'au départ : rien n'a été détruit puis
      // recréé, donc aucune fenêtre où le projet n'a pas de liste.
      expect(after.id).toBe(before.id);
      expect(
        await countWhere(
          dataSource,
          'shopping_lists',
          'project_id',
          fixture.projectId,
        ),
      ).toBe(1);

      // Le prix relevé survit dans les deux ordonnancements : soit la
      // correction a suivi la régénération, soit la régénération l'a reportée.
      const peinture = after.items_json.material_items.find(
        (item) => item.material_id === PEINTURE,
      );
      expect(peinture?.real_unit_price).toBe(31.5);
    });
  });

  /**
   * Trace du « 30 jours satisfait ou remboursé » (E3-3).
   *
   * Ce qui ne peut se voir que contre une vraie base : l'unicité de
   * `stripe_refund_id`. C'est elle, et non le code, qui garantit qu'un
   * remboursement n'est jamais compté deux fois — deux demandes simultanées,
   * un retry réseau, et le webhook `charge.refunded` qui suit notre propre
   * appel décrivent tous le **même** remboursement. Un mock de dépôt dirait
   * toujours ce qu'on lui fait dire.
   */
  describe('Trace des remboursements', () => {
    async function seedUser(suffix: string): Promise<string> {
      const user = await dataSource.getRepository(User).save({
        email: `refund-${suffix}@toise.test`,
        firebase_uid: `firebase-refund-${suffix}`,
      });
      return user.id;
    }

    function refundRow(userId: string, refundId: string) {
      return {
        user_id: userId,
        stripe_subscription_id: 'sub_refund',
        stripe_invoice_id: 'in_refund',
        stripe_charge_id: 'ch_refund',
        stripe_refund_id: refundId,
        amount_cents: 27900,
        currency: 'eur',
        origin: 'self_service',
        reason: null,
        invoice_paid_at: new Date(),
        eligible_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
    }

    it('n’enregistre qu’une ligne pour deux écritures concurrentes du même remboursement', async () => {
      const userId = await seedUser('concurrent');
      const repo = dataSource.getRepository(SubscriptionRefund);

      const insert = () =>
        repo
          .createQueryBuilder()
          .insert()
          .values(refundRow(userId, 're_concurrent'))
          .orIgnore()
          .execute();

      // Les deux partent ensemble : c'est la contrainte d'unicité, et non
      // l'ordre d'exécution, qui doit trancher.
      await Promise.all([insert(), insert(), insert()]);

      expect(await repo.count({ where: { user_id: userId } })).toBe(1);
    });

    /**
     * Le webhook `charge.refunded` arrive **après** notre propre appel et
     * décrit le même remboursement. Il doit être absorbé sans lever : c'est le
     * cas nominal, pas l'exception.
     */
    it('absorbe le doublon que le webhook produit après une demande', async () => {
      const userId = await seedUser('webhook');
      const repo = dataSource.getRepository(SubscriptionRefund);

      await repo
        .createQueryBuilder()
        .insert()
        .values(refundRow(userId, 're_double'))
        .orIgnore()
        .execute();

      await expect(
        repo
          .createQueryBuilder()
          .insert()
          .values({
            ...refundRow(userId, 're_double'),
            origin: 'stripe_dashboard',
          })
          .orIgnore()
          .execute(),
      ).resolves.toBeDefined();

      const rows = await repo.find({ where: { user_id: userId } });
      expect(rows).toHaveLength(1);
      // La première écriture fait foi : c'est celle qui porte la condition
      // réellement vérifiée, fenêtre comprise.
      expect(rows[0].origin).toBe('self_service');
      expect(rows[0].eligible_until).not.toBeNull();
    });

    it('laisse coexister deux remboursements distincts du même compte', async () => {
      const userId = await seedUser('deux');
      const repo = dataSource.getRepository(SubscriptionRefund);

      for (const id of ['re_a', 're_b']) {
        await repo
          .createQueryBuilder()
          .insert()
          .values(refundRow(userId, id))
          .orIgnore()
          .execute();
      }

      expect(await repo.count({ where: { user_id: userId } })).toBe(2);
    });

    /**
     * La trace est une donnée personnelle : elle part avec le compte. La FK est
     * en CASCADE, contrairement à celle de `subscriptions` qui est en RESTRICT
     * — cette dernière force le passage par `cancelForAccountDeletion`, celle-ci
     * n'a rien à protéger chez Stripe.
     */
    it('disparaît avec le compte', async () => {
      const userId = await seedUser('cascade');
      const repo = dataSource.getRepository(SubscriptionRefund);
      await repo
        .createQueryBuilder()
        .insert()
        .values(refundRow(userId, 're_cascade'))
        .orIgnore()
        .execute();

      await dataSource.getRepository(User).delete({ id: userId });

      expect(await repo.count({ where: { user_id: userId } })).toBe(0);
    });

    // `requestRefund` n'est pas monté ici : il appelle Stripe, ce que cette
    // suite ne fait jamais. La condition et l'effet sur l'accès sont couverts
    // par `src/subscriptions/subscriptions.refund.service.spec.ts` ; ce qui est
    // éprouvé ici est ce que seule la base peut dire.
  });
});
