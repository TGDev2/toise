import { ConfigService } from '@nestjs/config';
import { mkdtemp, readdir, rm, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { migratedDataSource, truncateUserData } from './test-database';
import { User } from '../../src/users/entities/user.entity';
import { Organization } from '../../src/organizations/entities/organization.entity';
import {
  OrganizationMembership,
  OrganizationRole,
} from '../../src/organizations/entities/organization-membership.entity';
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
import { LaborTime } from '../../src/projects/entities/labor-time.entity';
import { ProjectsService } from '../../src/projects/projects.service';
import { ProjectPhoto } from '../../src/photos/entities/project-photo.entity';
import {
  CommunityProject,
  ModerationStatus,
} from '../../src/community/entities/community-project.entity';
import { LocalStorageService } from '../../src/photos/storage/local-storage.service';
import { DataRetentionService } from '../../src/data-retention/data-retention.service';
import { UsersService } from '../../src/users/users.service';
import { OrgContextService } from '../../src/organizations/org-context.service';
import { AuthService } from '../../src/auth/auth.service';
import type { FirebaseConfig } from '../../src/config/firebase.config';
import type { CompanyProfilesService } from '../../src/company-profiles/company-profiles.service';
import type { AnalyticsService } from '../../src/analytics/analytics.service';
import type { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';

/**
 * E6-1 — le droit à l'effacement, vérifié là où il se joue : un vrai PostgreSQL
 * et un vrai volume de fichiers.
 *
 * Aucun autre étage ne peut l'attester. Les `*.e2e-spec.ts` mockent les services
 * et ne touchent ni base ni disque ; les tests unitaires ne voient que des
 * doublures de stockage. Or la question posée est précisément « que reste-t-il
 * sur le volume après une suppression », et la réponse dépend de cascades SQL
 * réelles (`project_photos` part avec `projects`, qui part avec
 * `organizations`) et d'un `readdir` réel.
 *
 * Firebase, Stripe et l'analytique sont les seules doublures : ce sont des
 * dépendances externes, et aucune n'intervient dans ce que le test observe.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

interface Fixture {
  userId: string;
  firebaseUid: string;
  organizationId: string;
  projectId: string;
}

describe('Rétention et effacement (intégration, PostgreSQL et volume réels)', () => {
  let dataSource: DataSource;
  let uploadsPath: string;
  let storage: LocalStorageService;
  let retention: DataRetentionService;
  let auth: AuthService;
  let projects: ProjectsService;

  const firebaseDeleteUser = jest.fn();

  /** Photo + vignette réellement écrites sur le disque, comme `PhotosService`. */
  async function seedPhoto(projectId: string, fileId: string): Promise<void> {
    const storageUrl = await storage.save(
      Buffer.from(`photo-${fileId}`),
      `${projectId}/${fileId}.jpg`,
      'image/jpeg',
    );
    const thumbnailUrl = await storage.save(
      Buffer.from(`thumb-${fileId}`),
      `${projectId}/thumb_${fileId}.jpg`,
      'image/jpeg',
    );
    await dataSource.getRepository(ProjectPhoto).save({
      project_id: projectId,
      storage_url: storageUrl,
      thumbnail_url: thumbnailUrl,
      original_filename: `${fileId}.jpg`,
      mime_type: 'image/jpeg',
      size_bytes: 12,
    });
  }

  async function seedAccount(suffix: string): Promise<Fixture> {
    const user = await dataSource.getRepository(User).save({
      email: `retention-${suffix}@chiffreo.test`,
      firebase_uid: `firebase-retention-${suffix}`,
    });
    const organization = await dataSource.getRepository(Organization).save({
      name: `Org ${suffix}`,
      owner_user_id: user.id,
      is_personal: true,
    });
    await dataSource.getRepository(OrganizationMembership).save({
      organization_id: organization.id,
      user_id: user.id,
      role: OrganizationRole.OWNER,
    });
    const project = await dataSource.getRepository(Project).save({
      user_id: user.id,
      organization_id: organization.id,
      name: `Chantier ${suffix}`,
      room_name: 'Salon',
      work_type: ProjectWorkType.PAINTING,
      status: ProjectStatus.COMPLETED,
    });

    await seedPhoto(project.id, 'avant');
    await seedPhoto(project.id, 'apres');

    return {
      userId: user.id,
      firebaseUid: user.firebase_uid,
      organizationId: organization.id,
      projectId: project.id,
    };
  }

  /** Antidate la suppression logique : la rétention se mesure sur `deleted_at`. */
  async function softDeleteSince(
    projectId: string,
    daysAgo: number,
  ): Promise<void> {
    await dataSource.query(
      `UPDATE projects SET deleted_at = $2 WHERE id = $1`,
      [projectId, new Date(Date.now() - daysAgo * DAY_MS)],
    );
  }

  function projectFiles(projectId: string): Promise<string[]> {
    return readdir(join(uploadsPath, projectId)).catch(() => []);
  }

  beforeAll(async () => {
    dataSource = await migratedDataSource();
    uploadsPath = await mkdtemp(join(tmpdir(), 'chiffreo-retention-'));

    const config = {
      get: (key: string, fallback?: unknown) => {
        if (key === 'storage.localPath') return uploadsPath;
        if (key === 'dataRetention.days') return 30;
        if (key === 'dataRetention.dryRun') return false;
        return fallback;
      },
    } as unknown as ConfigService;

    storage = new LocalStorageService(config);
    retention = new DataRetentionService(
      dataSource.getRepository(Project),
      dataSource.getRepository(CommunityProject),
      storage,
      dataSource,
      config,
    );

    const usersService = new UsersService(
      dataSource.getRepository(User),
      dataSource.getRepository(Project),
    );
    const orgContext = new OrgContextService(
      dataSource.getRepository(User),
      dataSource.getRepository(Organization),
      dataSource.getRepository(OrganizationMembership),
    );

    auth = new AuthService(
      {
        getAuth: () => ({ deleteUser: firebaseDeleteUser }),
      } as unknown as FirebaseConfig,
      usersService,
      {} as CompanyProfilesService,
      { track: jest.fn() } as unknown as AnalyticsService,
      orgContext,
      {
        cancelForAccountDeletion: jest.fn().mockResolvedValue(undefined),
      } as unknown as SubscriptionsService,
      retention,
      storage,
    );

    projects = new ProjectsService(
      dataSource.getRepository(Project),
      dataSource.getRepository(Room),
      dataSource.getRepository(RoomDimensions),
      dataSource.getRepository(Opening),
      dataSource.getRepository(WorkType),
      dataSource.getRepository(ProjectWorkItem),
      dataSource,
      { track: jest.fn() } as unknown as AnalyticsService,
      dataSource.getRepository(LaborTime),
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await rm(uploadsPath, { recursive: true, force: true });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    firebaseDeleteUser.mockResolvedValue(undefined);
    await truncateUserData(dataSource);
    for (const entry of await readdir(uploadsPath)) {
      await rm(join(uploadsPath, entry), { recursive: true, force: true });
    }
  });

  /**
   * Le scénario exact de l'énoncé E6-1. Avant ce correctif il échouait : les
   * lignes partaient en cascade — donc les `storage_url`, seul moyen de
   * retrouver les fichiers — et les photos restaient sur le volume à jamais.
   */
  describe('suppression de compte', () => {
    it('ne laisse aucun fichier sur le volume', async () => {
      const fixture = await seedAccount('compte');
      expect(await projectFiles(fixture.projectId)).toHaveLength(4);

      await auth.deleteAccount(fixture.firebaseUid);

      expect(existsSync(join(uploadsPath, fixture.projectId))).toBe(false);
      expect(await readdir(uploadsPath)).toEqual([]);
      expect(
        await dataSource.getRepository(User).findOneBy({ id: fixture.userId }),
      ).toBeNull();
      expect(
        await dataSource
          .getRepository(Project)
          .createQueryBuilder('p')
          .withDeleted()
          .where('p.id = :id', { id: fixture.projectId })
          .getCount(),
      ).toBe(0);
      expect(firebaseDeleteUser).toHaveBeenCalledWith(fixture.firebaseUid);
    });

    it('emporte aussi les fichiers des projets déjà supprimés logiquement', async () => {
      const fixture = await seedAccount('deja-supprime');
      await softDeleteSince(fixture.projectId, 2);

      await auth.deleteAccount(fixture.firebaseUid);

      expect(await readdir(uploadsPath)).toEqual([]);
    });

    it("laisse intacts les fichiers d'une organisation qui survit", async () => {
      const owner = await seedAccount('proprietaire');
      const member = await dataSource.getRepository(User).save({
        email: 'membre@chiffreo.test',
        firebase_uid: 'firebase-membre',
      });
      // Le membre a son propre espace personnel, vide, et rejoint celui du
      // propriétaire : c'est son compte à lui qui part.
      const memberOrg = await dataSource.getRepository(Organization).save({
        name: 'Espace du membre',
        owner_user_id: member.id,
        is_personal: true,
      });
      await dataSource.getRepository(OrganizationMembership).save([
        {
          organization_id: memberOrg.id,
          user_id: member.id,
          role: OrganizationRole.OWNER,
        },
        {
          organization_id: owner.organizationId,
          user_id: member.id,
          role: OrganizationRole.MEMBER,
        },
      ]);

      await auth.deleteAccount('firebase-membre');

      // Depuis PLAT-4 le projet appartient à l'organisation, pas à son auteur :
      // il survit au départ d'un membre, ses fichiers aussi.
      expect(await projectFiles(owner.projectId)).toHaveLength(4);
    });
  });

  describe('purge de rétention', () => {
    it('efface les projets expirés, en base et sur disque', async () => {
      const fixture = await seedAccount('expire');
      await softDeleteSince(fixture.projectId, 31);

      const summary = await retention.purgeExpiredProjects();

      expect(summary.projects.map((p) => p.project_id)).toEqual([
        fixture.projectId,
      ]);
      expect(summary.files).toBe(4);
      expect(summary.failed).toEqual([]);
      expect(existsSync(join(uploadsPath, fixture.projectId))).toBe(false);
      expect(
        await dataSource
          .getRepository(Project)
          .createQueryBuilder('p')
          .withDeleted()
          .where('p.id = :id', { id: fixture.projectId })
          .getCount(),
      ).toBe(0);
      // La cascade suit : plus une seule ligne de photo.
      expect(
        await dataSource
          .getRepository(ProjectPhoto)
          .countBy({ project_id: fixture.projectId }),
      ).toBe(0);
    });

    it('laisse en place un projet encore dans sa fenêtre de rétention', async () => {
      const fixture = await seedAccount('recent');
      await softDeleteSince(fixture.projectId, 5);

      const summary = await retention.purgeExpiredProjects();

      expect(summary.projects).toEqual([]);
      expect(await projectFiles(fixture.projectId)).toHaveLength(4);
    });

    it('ne touche jamais un projet vivant', async () => {
      const fixture = await seedAccount('vivant');

      await retention.purgeExpiredProjects();

      expect(await projectFiles(fixture.projectId)).toHaveLength(4);
    });

    it('recense sans rien effacer en simulation', async () => {
      const fixture = await seedAccount('simulation');
      await softDeleteSince(fixture.projectId, 31);

      const summary = await retention.purgeExpiredProjects({ dryRun: true });

      expect(summary).toMatchObject({ dry_run: true, files: 4 });
      expect(await projectFiles(fixture.projectId)).toHaveLength(4);
      expect(
        await dataSource
          .getRepository(Project)
          .createQueryBuilder('p')
          .withDeleted()
          .where('p.id = :id', { id: fixture.projectId })
          .getCount(),
      ).toBe(1);
    });

    it('est rejouable : la seconde passe ne trouve plus rien et ne casse pas', async () => {
      const fixture = await seedAccount('idempotence');
      await softDeleteSince(fixture.projectId, 31);

      await retention.purgeExpiredProjects();
      const second = await retention.purgeExpiredProjects();

      expect(second.projects).toEqual([]);
      expect(second.failed).toEqual([]);
    });

    it('reprend un projet dont les fichiers étaient déjà partis', async () => {
      const fixture = await seedAccount('fichiers-absents');
      await softDeleteSince(fixture.projectId, 31);
      await rm(join(uploadsPath, fixture.projectId), {
        recursive: true,
        force: true,
      });

      const summary = await retention.purgeExpiredProjects();

      // C'est l'état que laisse une panne entre l'effacement et le `DELETE` :
      // la passe suivante doit finir le travail, pas s'arrêter dessus.
      expect(summary.projects).toHaveLength(1);
      expect(summary.projects[0].files).toBe(0);
      expect(summary.failed).toEqual([]);
    });

    it("emporte les fichiers qu'aucune ligne ne référence", async () => {
      const fixture = await seedAccount('orphelins');
      await mkdir(join(uploadsPath, fixture.projectId), { recursive: true });
      await writeFile(
        join(uploadsPath, fixture.projectId, 'b.jpg.abcd.part'),
        'residu',
      );
      await softDeleteSince(fixture.projectId, 31);

      const summary = await retention.purgeExpiredProjects();

      expect(summary.files).toBe(5);
      expect(existsSync(join(uploadsPath, fixture.projectId))).toBe(false);
    });
  });

  /**
   * Le cas que l'énoncé demande de traiter explicitement : des photos publiées
   * dans la galerie communautaire vivent sous un projet qui, lui, peut être
   * supprimé.
   */
  describe('projet partagé en communauté', () => {
    async function publish(fixture: Fixture): Promise<CommunityProject> {
      const photos = await dataSource
        .getRepository(ProjectPhoto)
        .findBy({ project_id: fixture.projectId });

      return dataSource.getRepository(CommunityProject).save({
        project_id: fixture.projectId,
        user_id: fixture.userId,
        work_type: 'painting',
        title: 'Salon repeint',
        total_cost_cents: 12_000,
        duration_days: 3,
        length_cm: 400,
        width_cm: 300,
        height_cm: 250,
        before_photo_ids: [photos[0].id],
        after_photo_ids: [photos[1].id],
        moderation_status: ModerationStatus.APPROVED,
        gdpr_consent: true,
        gdpr_consent_at: new Date(),
        published_at: new Date(),
      });
    }

    it('retire la publication dès la suppression du projet', async () => {
      const fixture = await seedAccount('communaute');
      const entry = await publish(fixture);

      await projects.softDeleteProject(
        fixture.projectId,
        fixture.organizationId,
      );

      // La galerie ne sert plus rien : `findOne` exclut nativement les lignes
      // retirées, ce qui ferme du même coup le service des photos.
      expect(
        await dataSource
          .getRepository(CommunityProject)
          .findOneBy({ id: entry.id }),
      ).toBeNull();
      // La suppression reste logique : c'est ce qui laisse la reprise possible
      // pendant la rétention. Les fichiers restent donc en place.
      const row = await dataSource
        .getRepository(Project)
        .createQueryBuilder('p')
        .withDeleted()
        .where('p.id = :id', { id: fixture.projectId })
        .getOne();
      expect(row?.deleted_at).toBeInstanceOf(Date);
      expect(await projectFiles(fixture.projectId)).toHaveLength(4);
    });

    it('retire une publication survivante avant de purger, puis efface tout', async () => {
      const fixture = await seedAccount('communaute-purge');
      const entry = await publish(fixture);
      // Publication écrite avant le correctif : le projet est supprimé, elle non.
      await softDeleteSince(fixture.projectId, 31);

      const summary = await retention.purgeExpiredProjects();

      expect(summary.projects[0].community_withdrawn).toBe(true);
      expect(existsSync(join(uploadsPath, fixture.projectId))).toBe(false);
      // La ligne part avec le projet (`FK community_projects.project_id` en
      // CASCADE) : ni visible, ni conservée.
      expect(
        await dataSource
          .getRepository(CommunityProject)
          .createQueryBuilder('cp')
          .withDeleted()
          .where('cp.id = :id', { id: entry.id })
          .getCount(),
      ).toBe(0);
    });

    it('emporte la publication et les fichiers à la suppression du compte', async () => {
      const fixture = await seedAccount('communaute-compte');
      await publish(fixture);

      await auth.deleteAccount(fixture.firebaseUid);

      expect(await readdir(uploadsPath)).toEqual([]);
      expect(
        await dataSource
          .getRepository(CommunityProject)
          .createQueryBuilder('cp')
          .withDeleted()
          .getCount(),
      ).toBe(0);
    });
  });
});
