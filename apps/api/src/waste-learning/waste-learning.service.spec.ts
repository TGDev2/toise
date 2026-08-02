import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, IsNull, Not } from 'typeorm';
import { WasteLearningService } from './waste-learning.service';
import { ShoppingList } from '../shopping-lists/entities/shopping-list.entity';
import { EstimationResult } from '../estimations/entities/estimation-result.entity';
import { Project } from '../projects/entities/project.entity';
import { WasteFactor } from '../materials/entities/waste-factor.entity';
import { LearnedWasteFactor } from '../materials/entities/learned-waste-factor.entity';

const MATERIAL_ID = 'mat-tile';

function makeShoppingList(
  index: number,
  overrides: {
    estimated?: number;
    actual?: number;
    finalized?: boolean;
    materialId?: string;
  } = {},
): ShoppingList {
  const {
    estimated = 10,
    actual = 10,
    finalized = true,
    materialId = MATERIAL_ID,
  } = overrides;

  return {
    id: `sl-${index}`,
    project_id: `proj-${index}`,
    estimation_id: `est-${index}`,
    updated_at: new Date('2026-07-01T00:00:00.000Z'),
    budget_summary_json: finalized
      ? { computed_at: '2026-07-15T10:00:00.000Z' }
      : null,
    items_json: {
      material_items: [
        {
          material_id: materialId,
          original_units_needed: estimated,
          units_needed: actual,
        },
      ],
      complementary_items: [],
    },
  } as unknown as ShoppingList;
}

function makeEstimation(
  index: number,
  lines: { pose_type: string; waste_factor_percent: number }[] = [
    { pose_type: 'diagonal', waste_factor_percent: 10 },
  ],
  materialId = MATERIAL_ID,
): EstimationResult {
  return {
    id: `est-${index}`,
    skill_level: 'intermediate',
    items_json: lines.map((l) => ({ material_id: materialId, ...l })),
  } as unknown as EstimationResult;
}

describe('WasteLearningService', () => {
  let service: WasteLearningService;

  const shoppingListRepoMock = { find: jest.fn() };
  const estimationRepoMock = { find: jest.fn() };
  const wasteFactorRepoMock = { find: jest.fn() };
  const learnedRepoMock = {
    find: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
  };
  // `persist` ecrit desormais dans une transaction porteuse d'un verrou
  // consultatif : le retrait et la reecriture sont une seule verite publiee.
  const transactionManagerMock = {
    query: jest.fn().mockResolvedValue([]), // pg_advisory_xact_lock
    getRepository: jest.fn(() => learnedRepoMock),
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
    withDeleted: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };
  const projectRepoMock = {
    createQueryBuilder: jest.fn(() => projectQueryBuilderMock),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    shoppingListRepoMock.find.mockResolvedValue([]);
    estimationRepoMock.find.mockResolvedValue([]);
    projectQueryBuilderMock.getRawMany.mockResolvedValue([]);
    // Catalogue : 10 % en (standard, intermediate), pas de ligne `diagonal`.
    wasteFactorRepoMock.find.mockResolvedValue([
      {
        material_id: MATERIAL_ID,
        pose_type: 'standard',
        skill_level: 'intermediate',
        factor_percent: '10.00',
      },
    ]);
    learnedRepoMock.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WasteLearningService,
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
          provide: getRepositoryToken(WasteFactor),
          useValue: wasteFactorRepoMock,
        },
        {
          provide: getRepositoryToken(LearnedWasteFactor),
          useValue: learnedRepoMock,
        },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get(WasteLearningService);
  });

  /** n chantiers terminés, un par organisation, achetant `actual` pour `estimated`. */
  function seed(
    count: number,
    options: { estimated?: number; actual?: number } = {},
  ): void {
    const lists = Array.from({ length: count }, (_, i) =>
      makeShoppingList(i, options),
    );
    shoppingListRepoMock.find.mockResolvedValue(lists);
    estimationRepoMock.find.mockResolvedValue(
      Array.from({ length: count }, (_, i) => makeEstimation(i)),
    );
    projectQueryBuilderMock.getRawMany.mockResolvedValue(
      Array.from({ length: count }, (_, i) => ({
        id: `proj-${i}`,
        organization_id: `org-${i}`,
      })),
    );
  }

  it('does nothing when no shopping list has been finalized', async () => {
    const summary = await service.run();

    expect(summary.observations).toBe(0);
    expect(summary.cells).toBe(0);
    expect(estimationRepoMock.find).not.toHaveBeenCalled();
    expect(learnedRepoMock.upsert).not.toHaveBeenCalled();
  });

  it('only reads finalized shopping lists', async () => {
    await service.run();

    // Une liste non finalisée porte le plus souvent la quantité générée jamais
    // relue : la compter reviendrait à apprendre du moteur lui-même.
    const [options] = shoppingListRepoMock.find.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(options.where.budget_summary_json).toEqual(Not(IsNull()));
  });

  it('learns a factor from real purchases and persists it', async () => {
    seed(12, { estimated: 10, actual: 11 });

    const summary = await service.run();

    expect(summary.observations).toBe(12);
    expect(summary.by_status.learned).toBe(1);
    expect(learnedRepoMock.upsert).toHaveBeenCalledTimes(1);

    const [rows, conflictPaths] = learnedRepoMock.upsert.mock.calls[0] as [
      Record<string, unknown>[],
      string[],
    ];
    expect(conflictPaths).toEqual(['material_id', 'pose_type', 'skill_level']);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        material_id: MATERIAL_ID,
        // Le catalogue n'a pas de ligne `diagonal` : la référence est celle que
        // le moteur a réellement appliquée, la pose `standard` du même niveau.
        pose_type: 'diagonal',
        skill_level: 'intermediate',
        baseline_percent: 10,
        sample_size: 12,
      }),
    );
    expect(rows[0].observed_percent).toBeCloseTo(21);
    expect(rows[0].factor_percent as number).toBeGreaterThan(10);
    expect(rows[0].factor_percent as number).toBeLessThan(21);
  });

  it('ignores an item whose pose or applied factor is ambiguous', async () => {
    seed(12, { estimated: 10, actual: 11 });
    // ENG-2 : la ligne d'achat agrège deux pièces posées différemment —
    // l'écart n'est attribuable à aucune cellule en particulier.
    estimationRepoMock.find.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) =>
        makeEstimation(i, [
          { pose_type: 'diagonal', waste_factor_percent: 10 },
          { pose_type: 'standard', waste_factor_percent: 8 },
        ]),
      ),
    );

    const summary = await service.run();

    expect(summary.observations).toBe(0);
    expect(learnedRepoMock.upsert).not.toHaveBeenCalled();
  });

  it('counts one observation per material on a pre-ENG-2 list', async () => {
    // Liste antérieure à la mutualisation : le même matériau y figure une fois
    // par (pièce × work item). Il ne doit peser qu'une fois dans la cellule.
    const list = makeShoppingList(0, { estimated: 10, actual: 11 });
    list.items_json.material_items = [
      ...list.items_json.material_items,
      { ...list.items_json.material_items[0] },
      { ...list.items_json.material_items[0] },
    ];
    shoppingListRepoMock.find.mockResolvedValue([list]);
    estimationRepoMock.find.mockResolvedValue([makeEstimation(0)]);
    projectQueryBuilderMock.getRawMany.mockResolvedValue([
      { id: 'proj-0', organization_id: 'org-0' },
    ]);

    const summary = await service.run();

    expect(summary.observations).toBe(1);
  });

  it('ignores a material that was finally not bought at all', async () => {
    seed(12, { estimated: 10, actual: 0 });

    const summary = await service.run();

    expect(summary.observations).toBe(0);
  });

  it('ignores a list whose estimation has disappeared', async () => {
    seed(12, { estimated: 10, actual: 11 });
    estimationRepoMock.find.mockResolvedValue([]);

    const summary = await service.run();

    expect(summary.observations).toBe(0);
  });

  it('removes a learned factor the data no longer supports', async () => {
    // Plus aucune observation, mais une valeur apprise lors d'une passe
    // précédente : sans retrait, elle resterait appliquée pour toujours.
    learnedRepoMock.find.mockResolvedValue([
      {
        id: 'lwf-1',
        material_id: MATERIAL_ID,
        pose_type: 'diagonal',
        skill_level: 'intermediate',
      },
    ]);

    const summary = await service.run();

    expect(summary.removed).toBe(1);
    expect(learnedRepoMock.delete).toHaveBeenCalledWith(['lwf-1']);
  });

  it('keeps a learned factor that is still supported', async () => {
    seed(12, { estimated: 10, actual: 11 });
    learnedRepoMock.find.mockResolvedValue([
      {
        id: 'lwf-1',
        material_id: MATERIAL_ID,
        pose_type: 'diagonal',
        skill_level: 'intermediate',
      },
    ]);

    const summary = await service.run();

    expect(summary.removed).toBe(0);
    expect(learnedRepoMock.delete).not.toHaveBeenCalled();
    expect(learnedRepoMock.upsert).toHaveBeenCalledTimes(1);
  });

  it('reports a cell that stays below the volume threshold', async () => {
    seed(3, { estimated: 10, actual: 11 });

    const summary = await service.run();

    expect(summary.by_status.insufficient_volume).toBe(1);
    expect(summary.by_status.learned).toBe(0);
    expect(learnedRepoMock.upsert).not.toHaveBeenCalled();
  });

  it('swallows and logs a failure in the weekly cron', async () => {
    shoppingListRepoMock.find.mockRejectedValue(new Error('base injoignable'));

    await expect(service.runWeekly()).resolves.toBeUndefined();
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
        [4071205003],
      );
    });

    it('passe par le manager de la transaction, jamais par le repository nu', async () => {
      learnedRepoMock.delete.mockClear();
      learnedRepoMock.upsert.mockClear();
      transactionManagerMock.getRepository.mockClear();

      await service.run();

      expect(transactionManagerMock.getRepository).toHaveBeenCalled();
    });
  });
  // Une cellule qui n'apprend pas n'est ecrite nulle part : sans le detail dans
  // le resume du run, `by_status` annonce « N cellules sous le seuil » sans dire
  // lesquelles ni a quelle distance -- indistinguable d'une brique morte.
  describe('visibilite des cellules non apprises', () => {
    it('nomme la cellule bloquee et ce qui lui manque', async () => {
      seed(4, { estimated: 10, actual: 11 });

      const summary = await service.run();

      expect(summary.by_status.insufficient_volume).toBe(1);
      expect(summary.pending).toHaveLength(1);
      expect(summary.pending[0]).toEqual(
        expect.objectContaining({
          material_id: MATERIAL_ID,
          pose_type: 'diagonal',
          skill_level: 'intermediate',
          status: 'insufficient_volume',
          sample_size: 4,
          raw_sample_size: 4,
          organization_count: 4,
          missing_observations: 4,
          missing_organizations: 0,
        }),
      );
    });

    it('distingue le manque de chantiers du manque de clients distincts', async () => {
      // Six chantiers, tous du meme client : le plafond par organisation en
      // retient 3. Aucun chantier supplementaire de ce client ne debloquera la
      // cellule -- seul `missing_organizations` le dit.
      seed(6, { estimated: 10, actual: 11 });
      projectQueryBuilderMock.getRawMany.mockResolvedValue(
        Array.from({ length: 6 }, (_, i) => ({
          id: `proj-${i}`,
          organization_id: 'org-unique',
        })),
      );

      const summary = await service.run();

      expect(summary.pending[0]).toEqual(
        expect.objectContaining({
          sample_size: 3,
          raw_sample_size: 6,
          organization_count: 1,
          missing_organizations: 2,
        }),
      );
    });

    it('ne liste pas les cellules qui ont appris', async () => {
      seed(12, { estimated: 10, actual: 11 });

      const summary = await service.run();

      expect(summary.by_status.learned).toBe(1);
      expect(summary.pending).toEqual([]);
    });
  });
});
