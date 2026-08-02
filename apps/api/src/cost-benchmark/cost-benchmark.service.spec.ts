import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, IsNull, Not } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CostBenchmarkService } from './cost-benchmark.service';
import { ShoppingList } from '../shopping-lists/entities/shopping-list.entity';
import { EstimationResult } from '../estimations/entities/estimation-result.entity';
import { Project } from '../projects/entities/project.entity';
import { CostBenchmark } from './entities/cost-benchmark.entity';

interface LineSpec {
  material_id: string;
  work_type_code?: string;
  work_item_id?: string;
  room_id?: string;
  surface_m2?: number;
}

interface ItemSpec {
  material_id: string;
  units_needed?: number;
  real_unit_price?: number | null;
}

function makeEstimation(index: number, lines: LineSpec[]): EstimationResult {
  return {
    id: `est-${index}`,
    items_json: lines.map((l) => ({
      material_id: l.material_id,
      work_type_code: l.work_type_code ?? 'painting',
      work_type_label: `Label ${l.work_type_code ?? 'painting'}`,
      work_item_id: l.work_item_id ?? 'wi-1',
      room_id: l.room_id ?? 'room-1',
      surface_m2: l.surface_m2 ?? 20,
    })),
  } as unknown as EstimationResult;
}

function makeShoppingList(
  index: number,
  items: ItemSpec[],
  overrides: { finalized?: boolean; complementary?: unknown[] } = {},
): ShoppingList {
  const { finalized = true, complementary = [] } = overrides;
  return {
    id: `sl-${index}`,
    project_id: `proj-${index}`,
    estimation_id: `est-${index}`,
    updated_at: new Date('2026-07-01T00:00:00.000Z'),
    budget_summary_json: finalized
      ? { computed_at: '2026-07-15T10:00:00.000Z' }
      : null,
    items_json: {
      material_items: items.map((i) => ({
        material_id: i.material_id,
        units_needed: i.units_needed ?? 1,
        real_unit_price:
          i.real_unit_price === undefined ? 10 : i.real_unit_price,
      })),
      complementary_items: complementary,
    },
  } as unknown as ShoppingList;
}

/**
 * 10 chantiers identiques portés par 10 organisations distinctes : le plus
 * petit jeu qui franchit les deux seuils (10 observations, 5 organisations).
 */
function makeQualifyingCohort(costPerM2: number, surfaceM2 = 20) {
  const lists: ShoppingList[] = [];
  const estimations: EstimationResult[] = [];
  const orgRows: { id: string; organization_id: string }[] = [];

  for (let i = 0; i < 10; i++) {
    lists.push(
      makeShoppingList(i, [
        {
          material_id: 'mat-paint',
          units_needed: 1,
          real_unit_price: costPerM2 * surfaceM2,
        },
      ]),
    );
    estimations.push(
      makeEstimation(i, [{ material_id: 'mat-paint', surface_m2: surfaceM2 }]),
    );
    orgRows.push({ id: `proj-${i}`, organization_id: `org-${i}` });
  }

  return { lists, estimations, orgRows };
}

describe('CostBenchmarkService', () => {
  let service: CostBenchmarkService;

  const shoppingListRepoMock = { find: jest.fn(), findOne: jest.fn() };
  const estimationRepoMock = { find: jest.fn(), findOne: jest.fn() };
  const benchmarkRepoMock = {
    find: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
  };
  // `persist` ecrit desormais dans une transaction porteuse d'un verrou
  // consultatif : le retrait et la reecriture sont une seule verite publiee.
  const transactionManagerMock = {
    query: jest.fn().mockResolvedValue([]), // pg_advisory_xact_lock
    getRepository: jest.fn(() => benchmarkRepoMock),
  };
  const dataSourceMock = {
    transaction: jest.fn((cb: (m: typeof transactionManagerMock) => unknown) =>
      cb(transactionManagerMock),
    ),
  };

  const projectQueryBuilderMock = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
  };
  const projectRepoMock = {
    createQueryBuilder: jest.fn(() => projectQueryBuilderMock),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    shoppingListRepoMock.find.mockResolvedValue([]);
    estimationRepoMock.find.mockResolvedValue([]);
    projectQueryBuilderMock.getRawMany.mockResolvedValue([]);
    projectQueryBuilderMock.getRawOne.mockResolvedValue({
      organization_id: 'org-mine',
    });
    benchmarkRepoMock.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostBenchmarkService,
        {
          provide: getRepositoryToken(ShoppingList),
          useValue: shoppingListRepoMock,
        },
        {
          provide: getRepositoryToken(EstimationResult),
          useValue: estimationRepoMock,
        },
        { provide: getRepositoryToken(Project), useValue: projectRepoMock },
        {
          provide: getRepositoryToken(CostBenchmark),
          useValue: benchmarkRepoMock,
        },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get(CostBenchmarkService);
  });

  function loadCohort(cohort: ReturnType<typeof makeQualifyingCohort>) {
    shoppingListRepoMock.find.mockResolvedValue(cohort.lists);
    estimationRepoMock.find.mockResolvedValue(cohort.estimations);
    projectQueryBuilderMock.getRawMany.mockResolvedValue(cohort.orgRows);
  }

  describe('run — collecte et persistance', () => {
    it('ne lit que les budgets finalisés', async () => {
      await service.run();
      expect(shoppingListRepoMock.find).toHaveBeenCalledWith({
        where: { budget_summary_json: Not(IsNull()) },
      });
    });

    it('publie une cellule à partir d’une cohorte suffisante', async () => {
      loadCohort(makeQualifyingCohort(12));

      const summary = await service.run();

      expect(summary.observations).toBe(10);
      expect(summary.by_status.published).toBe(1);
      expect(benchmarkRepoMock.upsert).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            work_type_code: 'painting',
            surface_band: 'medium',
            median_cost_per_m2: 12,
            sample_size: 10,
            organization_count: 10,
          }),
        ],
        ['work_type_code', 'surface_band'],
      );
    });

    it('écarte un projet supprimé — son organisation n’est plus résolue', async () => {
      const cohort = makeQualifyingCohort(12);
      // `loadOrganizationIds` ne jointe pas les projets supprimés : deux
      // chantiers disparaissent de la cohorte, qui repasse sous le volume.
      cohort.orgRows = cohort.orgRows.slice(0, 8);
      loadCohort(cohort);

      const summary = await service.run();

      expect(summary.observations).toBe(8);
      expect(summary.by_status.published).toBe(0);
      expect(summary.by_status.insufficient_volume).toBe(1);
      expect(benchmarkRepoMock.upsert).not.toHaveBeenCalled();
    });

    it('retire une cellule qui ne satisfait plus les seuils', async () => {
      benchmarkRepoMock.find.mockResolvedValue([
        { id: 'cell-old', work_type_code: 'tiling', surface_band: 'small' },
      ]);
      loadCohort(makeQualifyingCohort(12));

      const summary = await service.run();

      expect(summary.removed).toBe(1);
      expect(benchmarkRepoMock.delete).toHaveBeenCalledWith(['cell-old']);
    });

    it('n’écrit ni ne supprime rien quand il n’y a aucune donnée', async () => {
      const summary = await service.run();

      expect(summary).toMatchObject({ observations: 0, cells: 0, removed: 0 });
      expect(benchmarkRepoMock.upsert).not.toHaveBeenCalled();
      expect(benchmarkRepoMock.delete).not.toHaveBeenCalled();
    });
  });

  describe('extraction du coût par ouvrage', () => {
    /** Fait tourner une passe sur un seul chantier et rend ses observations. */
    async function observationsFor(
      list: ShoppingList,
      estimation: EstimationResult,
    ) {
      shoppingListRepoMock.find.mockResolvedValue([list]);
      estimationRepoMock.find.mockResolvedValue([estimation]);
      projectQueryBuilderMock.getRawMany.mockResolvedValue([
        { id: list.project_id, organization_id: 'org-1' },
      ]);
      return service.run();
    }

    it('ne compte la surface qu’une fois quand deux matériaux la couvrent', async () => {
      // Sous-couche + finition : deux lignes d'estimation, une seule surface.
      const summary = await observationsFor(
        makeShoppingList(1, [
          { material_id: 'mat-primer', units_needed: 1, real_unit_price: 100 },
          { material_id: 'mat-paint', units_needed: 1, real_unit_price: 100 },
        ]),
        makeEstimation(1, [
          { material_id: 'mat-primer', surface_m2: 20, work_item_id: 'wi-1' },
          { material_id: 'mat-paint', surface_m2: 20, work_item_id: 'wi-1' },
        ]),
      );

      expect(summary.observations).toBe(1);
      // 200 € / 20 m² = 10 €/m². Sommer 40 m² aurait donné 5.
      expect(summary.cells).toBe(1);
      expect(summary.by_status.insufficient_anonymity).toBe(1);
    });

    it('additionne les surfaces de deux pièces du même ouvrage', async () => {
      const summary = await observationsFor(
        makeShoppingList(1, [
          { material_id: 'mat-paint', units_needed: 1, real_unit_price: 300 },
        ]),
        makeEstimation(1, [
          { material_id: 'mat-paint', surface_m2: 20, room_id: 'room-1' },
          { material_id: 'mat-paint', surface_m2: 10, room_id: 'room-2' },
        ]),
      );

      expect(summary.observations).toBe(1);
    });

    it('écarte le chantier quand un matériau relève de deux ouvrages', async () => {
      const summary = await observationsFor(
        makeShoppingList(1, [
          { material_id: 'mat-shared', units_needed: 1, real_unit_price: 100 },
        ]),
        makeEstimation(1, [
          {
            material_id: 'mat-shared',
            work_type_code: 'painting',
            work_item_id: 'wi-1',
          },
          {
            material_id: 'mat-shared',
            work_type_code: 'wall_covering',
            work_item_id: 'wi-2',
          },
        ]),
      );

      expect(summary.observations).toBe(0);
    });

    it('écarte le chantier quand une ligne d’achat n’a pas de ligne d’estimation', async () => {
      const summary = await observationsFor(
        makeShoppingList(1, [
          { material_id: 'mat-paint', units_needed: 1, real_unit_price: 100 },
          { material_id: 'mat-orphan', units_needed: 1, real_unit_price: 100 },
        ]),
        makeEstimation(1, [{ material_id: 'mat-paint' }]),
      );

      expect(summary.observations).toBe(0);
    });

    it('écarte l’ouvrage partiellement chiffré sans écarter les autres', async () => {
      const summary = await observationsFor(
        makeShoppingList(1, [
          { material_id: 'mat-paint', units_needed: 1, real_unit_price: null },
          { material_id: 'mat-tile', units_needed: 1, real_unit_price: 400 },
        ]),
        makeEstimation(1, [
          { material_id: 'mat-paint', work_type_code: 'painting' },
          {
            material_id: 'mat-tile',
            work_type_code: 'tiling',
            work_item_id: 'wi-2',
          },
        ]),
      );

      expect(summary.observations).toBe(1);
    });

    it('exclut les consommables, sans type d’ouvrage rattachable', async () => {
      const summary = await observationsFor(
        makeShoppingList(
          1,
          [{ material_id: 'mat-paint', units_needed: 1, real_unit_price: 200 }],
          {
            complementary: [
              {
                complementary_material_id: 'comp-1',
                quantity: 5,
                real_unit_price: 999,
                is_removed: false,
              },
            ],
          },
        ),
        makeEstimation(1, [{ material_id: 'mat-paint', surface_m2: 20 }]),
      );

      // Le consommable n'a pas fait basculer l'observation de bande ni de
      // cellule : une seule cellule, sur la peinture seule.
      expect(summary.observations).toBe(1);
      expect(summary.cells).toBe(1);
    });
  });

  describe('getForProject', () => {
    const publishedCell = {
      id: 'cell-1',
      work_type_code: 'painting',
      surface_band: 'medium',
      // Depuis R6, la conversion `string` -> `number` du driver est faite
      // par le `numericTransformer` de l'entite, donc en amont d'ici : ce
      // mock rend ce que le repository rend reellement. L'invariant lui-meme
      // est couvert par `common/transformers/numeric.transformer.spec.ts`,
      // qui verifie en plus qu'aucune colonne n'y echappe.
      median_cost_per_m2: 15,
      sample_size: 12,
      organization_count: 6,
      computed_at: new Date('2026-08-01T00:00:00.000Z'),
    };

    beforeEach(() => {
      shoppingListRepoMock.findOne.mockResolvedValue(
        makeShoppingList(1, [
          { material_id: 'mat-paint', units_needed: 1, real_unit_price: 240 },
        ]),
      );
      estimationRepoMock.findOne.mockResolvedValue(
        makeEstimation(1, [{ material_id: 'mat-paint', surface_m2: 20 }]),
      );
      benchmarkRepoMock.find.mockResolvedValue([publishedCell]);
    });

    it('situe le projet sous la médiane de sa cohorte', async () => {
      const result = await service.getForProject('proj-1', 'org-mine');

      expect(result.comparisons).toHaveLength(1);
      expect(result.comparisons[0]).toMatchObject({
        work_type_code: 'painting',
        work_type_label: 'Label painting',
        surface_band: 'medium',
        cost_per_m2: 12,
        median_cost_per_m2: 15,
        delta_percent: 20,
        position: 'below',
        sample_size: 12,
        organization_count: 6,
      });
      expect(result.overall).toMatchObject({
        cost: 240,
        reference_cost: 300,
        delta_percent: 20,
      });
      expect(result.computed_at).toBe('2026-08-01T00:00:00.000Z');
    });

    it('signale un ouvrage sans cohorte publiable au lieu de l’inventer', async () => {
      benchmarkRepoMock.find.mockResolvedValue([]);

      const result = await service.getForProject('proj-1', 'org-mine');

      expect(result.comparisons).toEqual([]);
      expect(result.overall).toBeNull();
      expect(result.work_types_without_reference).toEqual(['Label painting']);
    });

    it('ne compare pas une bande de surface différente de celle du projet', async () => {
      estimationRepoMock.findOne.mockResolvedValue(
        makeEstimation(1, [{ material_id: 'mat-paint', surface_m2: 4 }]),
      );

      const result = await service.getForProject('proj-1', 'org-mine');

      expect(result.comparisons).toEqual([]);
      expect(result.work_types_without_reference).toEqual(['Label painting']);
    });

    it('ne rend rien sans liste d’achats', async () => {
      shoppingListRepoMock.findOne.mockResolvedValue(null);

      const result = await service.getForProject('proj-1', 'org-mine');

      expect(result).toEqual({
        comparisons: [],
        overall: null,
        work_types_without_reference: [],
        computed_at: null,
      });
    });

    it('refuse un projet d’une autre organisation', async () => {
      projectQueryBuilderMock.getRawOne.mockResolvedValue({
        organization_id: 'org-other',
      });

      await expect(
        service.getForProject('proj-1', 'org-mine'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('renvoie 404 sur un projet inexistant', async () => {
      projectQueryBuilderMock.getRawOne.mockResolvedValue(undefined);

      await expect(
        service.getForProject('proj-1', 'org-mine'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('runWeekly', () => {
    it('avale l’erreur pour ne pas tuer le process du cron', async () => {
      shoppingListRepoMock.find.mockRejectedValue(new Error('db down'));
      await expect(service.runWeekly()).resolves.toBeUndefined();
    });
  });

  // R11 : `delete(stale)` puis `upsert(kept)` sans transaction laissait une
  // fenetre ou la verite publiee etait amputee, et un echec entre les deux la
  // laissait ouverte jusqu'au run suivant -- une semaine. Le verrou, lui, ecarte
  // l'entrelacement du @Cron hebdomadaire et d'un declenchement manuel.
  describe('persistance transactionnelle', () => {
    it('ecrit dans une transaction, sous verrou consultatif', async () => {
      await service.run();

      expect(dataSourceMock.transaction).toHaveBeenCalledTimes(1);
      expect(transactionManagerMock.query).toHaveBeenCalledWith(
        'SELECT pg_advisory_xact_lock($1)',
        [4071205004],
      );
    });

    it('passe par le manager de la transaction, jamais par le repository nu', async () => {
      benchmarkRepoMock.delete.mockClear();
      benchmarkRepoMock.upsert.mockClear();
      transactionManagerMock.getRepository.mockClear();

      await service.run();

      expect(transactionManagerMock.getRepository).toHaveBeenCalled();
    });
  });
});
