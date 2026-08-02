import { ConflictException, HttpException } from '@nestjs/common';
import { DataSource } from 'typeorm';
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
  OpeningSource,
  OpeningType,
} from '../../src/projects/entities/opening.entity';
import { ProjectWorkItem } from '../../src/projects/entities/project-work-item.entity';
import { WorkType } from '../../src/projects/entities/work-type.entity';
import { ProjectsService } from '../../src/projects/projects.service';
import { AnalysisService } from '../../src/analysis/analysis.service';
import {
  AnalysisJob,
  AnalysisJobStatus,
} from '../../src/analysis/entities/analysis-job.entity';
import type { CvAnalysisResponse } from '../../src/analysis/cv-client/cv-client.service';
import type { CvClientService } from '../../src/analysis/cv-client/cv-client.service';
import type { PhotosService } from '../../src/photos/photos.service';
import type { CvAccuracyService } from '../../src/analysis/cv-accuracy.service';
import type { FeatureGatesService } from '../../src/feature-gates/feature-gates.service';

/**
 * Ce qu'un job d'analyse CV doit garantir, et que seul un vrai PostgreSQL peut
 * démontrer : exclusivité (une seule analyse active par projet, y compris sous
 * deux appels simultanés), durabilité (un job perdu au redémarrage ne bloque
 * pas le projet pour toujours) et atomicité (le projet et le job basculent
 * ensemble, jamais à moitié).
 *
 * Cf. `test/README.md` : les `*.e2e-spec.ts` mockent les services et ne
 * peuvent rien prouver de tout cela.
 */

const CV_SUCCESS: CvAnalysisResponse = {
  status: 'success',
  dimensions: { length_cm: 401, width_cm: 301, height_cm: 251 },
  confidence: 'medium',
  confidence_score: 0.6,
  reference_detected: true,
  openings: [],
  raw_output: {},
} as unknown as CvAnalysisResponse;

interface Fixture {
  organizationId: string;
  projectId: string;
  roomId: string;
}

/**
 * Retient les appelants jusqu'à ce qu'ils soient `expected` à attendre, puis
 * les relâche ensemble.
 *
 * Sans cela, le test de concurrence dépendrait de l'ordonnancement : deux
 * `startAnalysis` lancés en parallèle se doublent parfois, parfois non. La
 * barrière force l'entrelacement que la contrainte doit refuser, pour que le
 * test échoue toujours si l'exclusivité repose de nouveau sur un simple
 * contrôle d'absence applicatif.
 */
function barrier(expected: number): () => Promise<void> {
  let arrived = 0;
  let open: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });

  return async () => {
    arrived += 1;
    if (arrived >= expected) open();
    await gate;
  };
}

async function seedProject(
  dataSource: DataSource,
  suffix: string,
): Promise<Fixture> {
  const user = await dataSource.getRepository(User).save({
    email: `job-${suffix}@chiffreo.test`,
    firebase_uid: `firebase-job-${suffix}`,
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

  return {
    organizationId: organization.id,
    projectId: project.id,
    roomId: room.id,
  };
}

describe("Jobs d'analyse CV (intégration, PostgreSQL réel)", () => {
  let dataSource: DataSource;
  let analysisService: AnalysisService;
  let projectsService: ProjectsService;
  let cvAnalyze: jest.Mock<Promise<CvAnalysisResponse>, []>;
  /** Point d'attente inséré dans `getProjectPhotos` par le test de concurrence. */
  let beforeJobLookup: () => Promise<void>;

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

    projectsService = new ProjectsService(
      dataSource.getRepository(Project),
      dataSource.getRepository(Room),
      dataSource.getRepository(RoomDimensions),
      dataSource.getRepository(Opening),
      dataSource.getRepository(WorkType),
      dataSource.getRepository(ProjectWorkItem),
      {
        isFeatureAllowed: () => Promise.resolve(true),
      } as unknown as FeatureGatesService,
      dataSource,
    );

    cvAnalyze = jest.fn<Promise<CvAnalysisResponse>, []>();
    beforeJobLookup = () => Promise.resolve();
    analysisService = new AnalysisService(
      dataSource.getRepository(AnalysisJob),
      { analyze: cvAnalyze } as unknown as CvClientService,
      projectsService,
      {
        getProjectPhotos: async () => {
          await beforeJobLookup();
          return [{ storage_url: 'photo.jpg' }];
        },
      } as unknown as PhotosService,
      {
        getReport: () => Promise.resolve({ groups: [], overall: {} }),
      } as unknown as CvAccuracyService,
    );
  });

  /** `processAnalysis` est privée et lancée en fire-and-forget par `startAnalysis`. */
  function processAnalysis(
    jobId: string,
    projectId: string,
    organizationId: string,
  ): Promise<void> {
    return (
      analysisService as unknown as {
        processAnalysis: (
          jobId: string,
          projectId: string,
          organizationId: string,
          imagePaths: string[],
        ) => Promise<void>;
      }
    ).processAnalysis(jobId, projectId, organizationId, ['photo.jpg']);
  }

  async function activeJobCount(projectId: string): Promise<number> {
    const rows: Array<{ count: string }> = await dataSource.query(
      `SELECT COUNT(*)::text AS count FROM analysis_jobs
       WHERE project_id = $1 AND status IN ('pending', 'processing')`,
      [projectId],
    );
    return parseInt(rows[0].count, 10);
  }

  describe('Exclusivité', () => {
    it("n'ouvre qu'une seule analyse quand deux appels partent en même temps", async () => {
      const fixture = await seedProject(dataSource, 'concurrent');
      cvAnalyze.mockResolvedValue({
        status: 'no_reference',
        reference_detected: false,
        openings: [],
        raw_output: {},
      } as unknown as CvAnalysisResponse);
      // Les deux appels franchissent le contrôle d'absence avant que l'un
      // d'eux n'ait inséré sa ligne : l'entrelacement que le constat décrit.
      beforeJobLookup = barrier(2);

      const outcomes = await Promise.allSettled([
        analysisService.startAnalysis(
          fixture.projectId,
          fixture.organizationId,
        ),
        analysisService.startAnalysis(
          fixture.projectId,
          fixture.organizationId,
        ),
      ]);

      const accepted = outcomes.filter((o) => o.status === 'fulfilled');
      const refused = outcomes.filter((o) => o.status === 'rejected');

      expect(accepted).toHaveLength(1);
      expect(refused).toHaveLength(1);
      // Le refus doit rester lisible côté client : 409, pas une erreur SQL brute.
      const error = refused[0].reason as HttpException;
      expect(error).toBeInstanceOf(ConflictException);

      const rows: Array<{ count: string }> = await dataSource.query(
        'SELECT COUNT(*)::text AS count FROM analysis_jobs WHERE project_id = $1',
        [fixture.projectId],
      );
      expect(parseInt(rows[0].count, 10)).toBe(1);
    });
  });

  describe('Durabilité', () => {
    it('ne laisse pas un job perdu au redémarrage bloquer le projet', async () => {
      const fixture = await seedProject(dataSource, 'stale');
      cvAnalyze.mockResolvedValue({
        status: 'no_reference',
        reference_detected: false,
        openings: [],
        raw_output: {},
      } as unknown as CvAnalysisResponse);

      // Un job resté `processing` : le traitement vivait dans une promesse en
      // mémoire, l'API a redémarré, plus personne ne le reprendra.
      const orphan = await dataSource.getRepository(AnalysisJob).save({
        project_id: fixture.projectId,
        status: AnalysisJobStatus.PROCESSING,
        progress_pct: 10,
      });
      await dataSource.query(
        `UPDATE analysis_jobs SET updated_at = now() - interval '2 hours',
         created_at = now() - interval '2 hours' WHERE id = $1`,
        [orphan.id],
      );

      const started = await analysisService.startAnalysis(
        fixture.projectId,
        fixture.organizationId,
      );

      expect(started.id).not.toBe(orphan.id);
      const reclaimed = await dataSource
        .getRepository(AnalysisJob)
        .findOneByOrFail({ id: orphan.id });
      expect(reclaimed.status).toBe(AnalysisJobStatus.FAILED);
      expect(reclaimed.error_message).toBeTruthy();
    });

    it('rend un job perdu visible comme échoué à la lecture de son statut', async () => {
      const fixture = await seedProject(dataSource, 'stale-status');
      const orphan = await dataSource.getRepository(AnalysisJob).save({
        project_id: fixture.projectId,
        status: AnalysisJobStatus.PROCESSING,
        progress_pct: 10,
      });
      await dataSource.query(
        `UPDATE analysis_jobs SET updated_at = now() - interval '2 hours'
         WHERE id = $1`,
        [orphan.id],
      );

      const status = await analysisService.getJobStatus(
        fixture.projectId,
        fixture.organizationId,
        orphan.id,
      );

      expect(status.status).toBe(AnalysisJobStatus.FAILED);
      expect(status.error_message).toBeTruthy();
    });

    it('laisse tranquille un job actif qui progresse encore', async () => {
      const fixture = await seedProject(dataSource, 'fresh');
      const running = await dataSource.getRepository(AnalysisJob).save({
        project_id: fixture.projectId,
        status: AnalysisJobStatus.PROCESSING,
        progress_pct: 10,
      });

      await expect(
        analysisService.startAnalysis(
          fixture.projectId,
          fixture.organizationId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      const untouched = await dataSource
        .getRepository(AnalysisJob)
        .findOneByOrFail({ id: running.id });
      expect(untouched.status).toBe(AnalysisJobStatus.PROCESSING);
      expect(await activeJobCount(fixture.projectId)).toBe(1);
    });
  });

  describe('Atomicité du résultat', () => {
    it("ne laisse pas de dimensions neuves derrière une écriture d'ouverture qui échoue", async () => {
      const fixture = await seedProject(dataSource, 'partial');
      cvAnalyze.mockResolvedValue({
        ...CV_SUCCESS,
        // `type` est un varchar(10) : la seconde insertion est refusée par la
        // base. L'API ne valide pas ce que le service CV lui renvoie.
        openings: [
          {
            type: 'door',
            width_cm: 90,
            height_cm: 204,
            count: 1,
            confidence: 0.9,
          },
          {
            type: 'fenetre-panoramique',
            width_cm: 120,
            height_cm: 110,
            count: 1,
            confidence: 0.8,
          },
        ],
      } as unknown as CvAnalysisResponse);

      const job = await dataSource.getRepository(AnalysisJob).save({
        project_id: fixture.projectId,
        status: AnalysisJobStatus.PENDING,
      });
      await processAnalysis(job.id, fixture.projectId, fixture.organizationId);

      const finished = await dataSource
        .getRepository(AnalysisJob)
        .findOneByOrFail({ id: job.id });
      expect(finished.status).toBe(AnalysisJobStatus.FAILED);

      // Le projet doit être resté exactement dans l'état d'avant l'analyse.
      const dimensions = await dataSource
        .getRepository(RoomDimensions)
        .findOneByOrFail({ room_id: fixture.roomId });
      expect(dimensions.length_cm).toBe(400);
      expect(
        await dataSource
          .getRepository(Opening)
          .countBy({ room_id: fixture.roomId }),
      ).toBe(0);
    });

    it('efface les ouvertures CV précédentes même quand la nouvelle analyse n’en trouve aucune', async () => {
      const fixture = await seedProject(dataSource, 'no-openings');
      await dataSource.getRepository(Opening).save({
        room_id: fixture.roomId,
        type: OpeningType.WINDOW,
        width_cm: 120,
        height_cm: 110,
        count: 1,
        source: OpeningSource.CV,
      });
      cvAnalyze.mockResolvedValue({ ...CV_SUCCESS, openings: [] });

      const job = await dataSource.getRepository(AnalysisJob).save({
        project_id: fixture.projectId,
        status: AnalysisJobStatus.PENDING,
      });
      await processAnalysis(job.id, fixture.projectId, fixture.organizationId);

      expect(
        await dataSource
          .getRepository(Opening)
          .countBy({ room_id: fixture.roomId, source: OpeningSource.CV }),
      ).toBe(0);
    });

    it('conserve les ouvertures saisies à la main', async () => {
      const fixture = await seedProject(dataSource, 'manual-openings');
      await dataSource.getRepository(Opening).save({
        room_id: fixture.roomId,
        type: OpeningType.DOOR,
        width_cm: 90,
        height_cm: 204,
        count: 1,
        source: OpeningSource.MANUAL,
      });
      cvAnalyze.mockResolvedValue({ ...CV_SUCCESS, openings: [] });

      const job = await dataSource.getRepository(AnalysisJob).save({
        project_id: fixture.projectId,
        status: AnalysisJobStatus.PENDING,
      });
      await processAnalysis(job.id, fixture.projectId, fixture.organizationId);

      expect(
        await dataSource
          .getRepository(Opening)
          .countBy({ room_id: fixture.roomId, source: OpeningSource.MANUAL }),
      ).toBe(1);
    });

    it('ne marque COMPLETED qu’une fois les dimensions écrites', async () => {
      const fixture = await seedProject(dataSource, 'ordering');
      cvAnalyze.mockResolvedValue({ ...CV_SUCCESS, openings: [] });

      const job = await dataSource.getRepository(AnalysisJob).save({
        project_id: fixture.projectId,
        status: AnalysisJobStatus.PENDING,
      });
      await processAnalysis(job.id, fixture.projectId, fixture.organizationId);

      const finished = await dataSource
        .getRepository(AnalysisJob)
        .findOneByOrFail({ id: job.id });
      const dimensions = await dataSource
        .getRepository(RoomDimensions)
        .findOneByOrFail({ room_id: fixture.roomId });

      expect(finished.status).toBe(AnalysisJobStatus.COMPLETED);
      expect(dimensions.length_cm).toBe(401);
      // `completed_at` postérieur à la dernière écriture du projet : le statut
      // COMPLETED ne peut pas être lu avant que la donnée soit là.
      expect(finished.completed_at!.getTime()).toBeGreaterThanOrEqual(
        dimensions.updated_at.getTime(),
      );
    });
  });
});
