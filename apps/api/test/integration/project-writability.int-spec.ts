import { DataSource, Repository } from 'typeorm';
import { migratedDataSource, truncateUserData } from './test-database';
import { User } from '../../src/users/entities/user.entity';
import { SubscriptionTier } from '../../src/users/entities/user.entity';
import { Organization } from '../../src/organizations/entities/organization.entity';
import {
  Project,
  ProjectStatus,
  WorkType as ProjectWorkType,
} from '../../src/projects/entities/project.entity';
import { Room } from '../../src/projects/entities/room.entity';
import { RoomDimensions } from '../../src/projects/entities/room-dimensions.entity';
import { Opening } from '../../src/projects/entities/opening.entity';
import { WorkType } from '../../src/projects/entities/work-type.entity';
import { ProjectWorkItem } from '../../src/projects/entities/project-work-item.entity';
import { ProjectsService } from '../../src/projects/projects.service';
import type { FeatureGatesService } from '../../src/feature-gates/feature-gates.service';

/**
 * La fenêtre d'écriture du palier gratuit, contre un vrai PostgreSQL.
 *
 * ## Pourquoi ce fichier existe
 *
 * `isProjectWritable` et `getWritableProjectIds` demandaient à TypeORM les
 * `take: 2` projets les plus récemment modifiés avec `select: ['id']`. Comme
 * `Project.rooms` est `eager`, TypeORM ne peut pas traduire `take` en un simple
 * `LIMIT` : il génère une sous-requête `SELECT DISTINCT … AS distinctAlias` qui
 * ne projette que les colonnes demandées, puis ordonne sur
 * `distinctAlias.Project_updated_at`. Colonne absente de la projection, donc
 * `QueryFailedError` — **à l'exécution seulement**.
 *
 * Conséquence en production : `PUT /projects/:id/dimensions`,
 * `POST /projects/:id/openings`, `POST /projects/:id/work-items`, la gestion des
 * pièces et `GET /projects` renvoyaient 500 pour **tout compte gratuit** — donc
 * pour tout invité, donc pour la totalité du parcours qu'E2-1 ouvre.
 *
 * Aucune suite ne pouvait le voir : les tests unitaires mockent le dépôt (un
 * `find` mocké ne construit aucun SQL) et les `*.e2e-spec.ts` mockent le
 * service. Seul PostgreSQL a un avis sur une requête SQL — d'où ce fichier,
 * exactement dans l'esprit de `test/README.md`.
 */
const FREE_TIER = { isFeatureAllowed: () => Promise.resolve(false) };

async function seedOrganization(
  dataSource: DataSource,
  suffix: string,
): Promise<string> {
  const user = await dataSource.getRepository(User).save({
    email: `writable-${suffix}@chiffreo.test`,
    firebase_uid: `firebase-writable-${suffix}`,
  });
  const organization = await dataSource.getRepository(Organization).save({
    name: `Org ${suffix}`,
    owner_user_id: user.id,
    is_personal: true,
  });
  return organization.id;
}

async function seedProject(
  dataSource: DataSource,
  organizationId: string,
  name: string,
  updatedAt: Date,
): Promise<string> {
  const project = await dataSource.getRepository(Project).save({
    organization_id: organizationId,
    name,
    room_name: 'Salon',
    work_type: ProjectWorkType.PAINTING,
    status: ProjectStatus.DRAFT,
  });
  // `updated_at` porte `@UpdateDateColumn` : seule une écriture SQL directe
  // permet de fabriquer un ordre de fraîcheur déterministe.
  await dataSource.query('UPDATE projects SET updated_at = $1 WHERE id = $2', [
    updatedAt,
    project.id,
  ]);
  await dataSource.getRepository(Room).save({
    project_id: project.id,
    name: 'Salon',
    sort_order: 0,
  });
  return project.id;
}

describe("Fenêtre d'écriture du palier gratuit (PostgreSQL réel)", () => {
  let dataSource: DataSource;
  let service: ProjectsService;

  beforeAll(async () => {
    dataSource = await migratedDataSource();

    const repo = <T extends object>(entity: {
      new (...args: never[]): T;
    }): Repository<T> => dataSource.getRepository(entity);

    service = new ProjectsService(
      repo(Project),
      repo(Room),
      repo(RoomDimensions),
      repo(Opening),
      repo(WorkType),
      repo(ProjectWorkItem),
      FREE_TIER as unknown as FeatureGatesService,
      dataSource,
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    await truncateUserData(dataSource);
  });

  it('exécute réellement la requête, au lieu de casser en SQL', async () => {
    const organizationId = await seedOrganization(dataSource, 'sql');
    const projectId = await seedProject(
      dataSource,
      organizationId,
      'Salon',
      new Date('2026-08-01T10:00:00.000Z'),
    );

    await expect(
      service.isProjectWritable(
        projectId,
        organizationId,
        SubscriptionTier.FREE,
      ),
    ).resolves.toBe(true);
  });

  it('retient les deux projets les plus récemment modifiés, et eux seuls', async () => {
    const organizationId = await seedOrganization(dataSource, 'window');
    const oldest = await seedProject(
      dataSource,
      organizationId,
      'Le plus ancien',
      new Date('2026-07-01T10:00:00.000Z'),
    );
    const middle = await seedProject(
      dataSource,
      organizationId,
      'Intermédiaire',
      new Date('2026-07-15T10:00:00.000Z'),
    );
    const newest = await seedProject(
      dataSource,
      organizationId,
      'Le plus récent',
      new Date('2026-08-01T10:00:00.000Z'),
    );

    const writable = await service.getWritableProjectIds(organizationId);

    expect(writable).toHaveLength(2);
    expect(writable).toEqual([newest, middle]);
    expect(writable).not.toContain(oldest);

    await expect(
      service.isProjectWritable(oldest, organizationId, SubscriptionTier.FREE),
    ).resolves.toBe(false);
  });

  it("ignore les projets d'une autre organisation", async () => {
    const mine = await seedOrganization(dataSource, 'mine');
    const other = await seedOrganization(dataSource, 'other');
    const myProject = await seedProject(
      dataSource,
      mine,
      'Le mien',
      new Date('2026-07-01T10:00:00.000Z'),
    );
    // Deux projets plus récents ailleurs : ils rempliraient la fenêtre si le
    // filtre d'organisation venait à sauter.
    await seedProject(
      dataSource,
      other,
      'Ailleurs 1',
      new Date('2026-08-01T10:00:00.000Z'),
    );
    await seedProject(
      dataSource,
      other,
      'Ailleurs 2',
      new Date('2026-08-02T10:00:00.000Z'),
    );

    await expect(
      service.isProjectWritable(myProject, mine, SubscriptionTier.FREE),
    ).resolves.toBe(true);
  });
});
