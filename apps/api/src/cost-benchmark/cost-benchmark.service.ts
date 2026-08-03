import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { ShoppingList } from '../shopping-lists/entities/shopping-list.entity';
import { costedUnits } from '../shopping-lists/closeout';
import {
  EstimationLineItem,
  EstimationResult,
} from '../estimations/entities/estimation-result.entity';
import { Project } from '../projects/entities/project.entity';
import { CostBenchmark } from './entities/cost-benchmark.entity';
import {
  BenchmarkCell,
  BenchmarkCellStatus,
  BenchmarkComparison,
  BenchmarkOverall,
  benchmarkCellKey,
  benchmarkShortfall,
  buildCostBenchmarks,
  compareToReference,
  CostObservation,
  resolveSurfaceBand,
  rollUpComparisons,
  SurfaceBand,
} from './cost-benchmark';

/** Clé de verrou consultatif propre à ce job (distincte de DATA-3 et des migrations). */
const COST_BENCHMARK_LOCK_KEY = 4_071_205_004;

/**
 * Cohorte non publiable, et ce qui lui manque.
 *
 * **Rien de tout ceci n'est persisté** : ces lignes sont recalculées à chaque
 * run et ne quittent pas son résumé, réservé à l'administration. La règle du
 * module pur tient : une cellule sous le seuil n'existe nulle part de façon
 * durable, et aucun coût n'apparaît ici — seulement des comptages de cohorte.
 */
export interface PendingBenchmarkCell {
  work_type_code: string;
  surface_band: SurfaceBand;
  status: BenchmarkCellStatus;
  sample_size: number;
  organization_count: number;
  missing_observations: number;
  missing_organizations: number;
}

export interface CostBenchmarkRunSummary {
  /** Ouvrages exploitables extraits des chantiers terminés. */
  observations: number;
  /** Cellules type d'ouvrage × bande de surface rencontrées. */
  cells: number;
  by_status: Record<BenchmarkCellStatus, number>;
  /** Cellules retirées faute de continuer à satisfaire les seuils. */
  removed: number;
  /** Cohortes non publiées, les plus proches du seuil en tête. */
  pending: PendingBenchmarkCell[];
  computed_at: string;
}

/** Le libellé est de l'affichage : il n'a pas sa place dans le module pur. */
export type LabelledComparison = BenchmarkComparison & {
  work_type_label: string;
};

export interface ProjectBenchmark {
  comparisons: LabelledComparison[];
  overall: BenchmarkOverall | null;
  /** Ouvrages du projet sans cohorte publiable, pour l'expliquer à l'écran. */
  work_types_without_reference: string[];
  computed_at: string | null;
}

/** Coût matériaux et surface d'un type d'ouvrage sur un chantier. */
interface WorkTypeCost {
  work_type_code: string;
  work_type_label: string;
  cost: number;
  surface_m2: number;
}

/**
 * BACKLOG DATA-4 : benchmark de coûts anonymisé. La méthode statistique et les
 * garde-fous d'anonymat vivent dans `cost-benchmark.ts` (pur) ; ce service ne
 * fait que collecter les observations, les persister et comparer un projet.
 *
 * Source des observations : les listes d'achats dont le budget a été
 * **finalisé** (`budget_summary_json ≠ null`), comme DATA-3 — seul moment où
 * les prix réels sont tous saisis, `finalizeBudgetSummary` le vérifiant.
 *
 * Un projet **supprimé sort de la cohorte** au recalcul suivant (jointure sans
 * `withDeleted`, à l'inverse de DATA-3). DATA-3 apprend une physique de
 * matériau, qui ne se rétracte pas ; DATA-4 publie des chiffres tirés de la
 * dépense de gens, et un effacement demandé doit se propager.
 */
@Injectable()
export class CostBenchmarkService {
  private readonly logger = new Logger(CostBenchmarkService.name);

  constructor(
    @InjectRepository(ShoppingList)
    private readonly shoppingListRepo: Repository<ShoppingList>,
    @InjectRepository(EstimationResult)
    private readonly estimationRepo: Repository<EstimationResult>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(CostBenchmark)
    private readonly benchmarkRepo: Repository<CostBenchmark>,
    private readonly dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_WEEK, { timeZone: 'Europe/Paris' })
  async runWeekly(): Promise<void> {
    try {
      const summary = await this.run();
      // Sans la distance au seuil, « 0 cellule publiée » se lit pareil au
      // premier chantier et au trois centième : le log ne dirait pas si la
      // cohorte progresse.
      const closest = summary.pending[0];
      this.logger.log(
        `Benchmark de coûts : ${summary.by_status.published} cellule(s) publiée(s) sur ${summary.cells}, ${summary.observations} observation(s), ${summary.removed} retrait(s).` +
          (closest
            ? ` ${summary.pending.length} cohorte(s) en attente, la plus proche à ${closest.missing_observations} observation(s) et ${closest.missing_organizations} organisation(s).`
            : ''),
      );
    } catch (err) {
      // Un rejet non capturé dans un cron tuerait le process : on trace et on
      // laisse la passe suivante retenter (le calcul est idempotent).
      this.logger.error(
        `Échec du recalcul du benchmark de coûts : ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async run(): Promise<CostBenchmarkRunSummary> {
    const observations = await this.collectObservations();
    const cells = buildCostBenchmarks(observations);
    const computedAt = new Date();

    const removed = await this.persist(cells, computedAt);

    const byStatus: Record<BenchmarkCellStatus, number> = {
      published: 0,
      insufficient_volume: 0,
      insufficient_anonymity: 0,
    };
    for (const cell of cells) byStatus[cell.status]++;

    return {
      observations: observations.length,
      cells: cells.length,
      by_status: byStatus,
      removed,
      pending: this.summarizePending(cells),
      computed_at: computedAt.toISOString(),
    };
  }

  /**
   * Les cohortes qui ne publient pas, de la plus proche du seuil à la plus
   * lointaine — le manque d'organisations d'abord : c'est le seul que le temps
   * ne comble pas si les mêmes clients reviennent.
   */
  private summarizePending(cells: BenchmarkCell[]): PendingBenchmarkCell[] {
    return cells
      .filter((c) => c.status !== 'published')
      .map((c) => ({
        work_type_code: c.work_type_code,
        surface_band: c.surface_band,
        status: c.status,
        sample_size: c.sample_size,
        organization_count: c.organization_count,
        ...benchmarkShortfall(c),
      }))
      .sort(
        (a, b) =>
          a.missing_organizations - b.missing_organizations ||
          a.missing_observations - b.missing_observations ||
          a.work_type_code.localeCompare(b.work_type_code),
      );
  }

  async findAll(): Promise<CostBenchmark[]> {
    return this.benchmarkRepo.find({
      order: { work_type_code: 'ASC', surface_band: 'ASC' },
    });
  }

  // --- Comparaison d'un projet ---------------------------------------------

  /**
   * Situe un projet face aux cellules publiées. Le projet est mesuré par
   * **exactement** la même fonction que les membres de la cohorte : une règle
   * d'extraction qui divergerait entre les deux côtés produirait un écart
   * imputable à la mesure, pas au chantier.
   */
  async getForProject(
    projectId: string,
    organizationId: string,
  ): Promise<ProjectBenchmark> {
    await this.assertProjectBelongsToOrg(projectId, organizationId);

    const empty: ProjectBenchmark = {
      comparisons: [],
      overall: null,
      work_types_without_reference: [],
      computed_at: null,
    };

    const shoppingList = await this.shoppingListRepo.findOne({
      where: { project_id: projectId },
    });
    if (!shoppingList) return empty;

    const estimation = await this.estimationRepo.findOne({
      where: { id: shoppingList.estimation_id },
    });
    if (!estimation) return empty;

    const costs = this.extractWorkTypeCosts(
      shoppingList,
      estimation.items_json,
    );
    if (!costs || costs.length === 0) return empty;

    const cells = await this.benchmarkRepo.find();
    const cellByKey = new Map(cells.map((c) => [benchmarkCellKey(c), c]));

    const comparisons: LabelledComparison[] = [];
    const withoutReference: string[] = [];
    let computedAt: Date | null = null;

    for (const entry of costs) {
      const surfaceBand = resolveSurfaceBand(entry.surface_m2);
      const cell = cellByKey.get(
        benchmarkCellKey({
          work_type_code: entry.work_type_code,
          surface_band: surfaceBand,
        }),
      );
      if (!cell) {
        withoutReference.push(entry.work_type_label);
        continue;
      }

      // La coercition locale qui vivait ici est devenue inutile : le
      // `numericTransformer` de l'entité garantit désormais le `number` que le
      // type déclaré promet, pour cette colonne comme pour les 29 autres.
      const median = cell.median_cost_per_m2;
      const costPerM2 = entry.cost / entry.surface_m2;

      comparisons.push({
        work_type_code: entry.work_type_code,
        work_type_label: entry.work_type_label,
        surface_band: surfaceBand,
        surface_m2: round2(entry.surface_m2),
        cost: round2(entry.cost),
        cost_per_m2: round2(costPerM2),
        median_cost_per_m2: median,
        sample_size: cell.sample_size,
        organization_count: cell.organization_count,
        ...compareToReference(costPerM2, median),
      });

      if (!computedAt || cell.computed_at > computedAt) {
        computedAt = cell.computed_at;
      }
    }

    return {
      comparisons,
      overall: rollUpComparisons(comparisons),
      work_types_without_reference: withoutReference,
      computed_at: computedAt ? computedAt.toISOString() : null,
    };
  }

  /**
   * Vérification de propriété sans hydrater `Project` : ses `rooms` sont en
   * `eager`, les charger pour lire un seul uuid serait gratuit.
   */
  private async assertProjectBelongsToOrg(
    projectId: string,
    organizationId: string,
  ): Promise<void> {
    const row = await this.projectRepo
      .createQueryBuilder('project')
      .select('project.organization_id', 'organization_id')
      .where('project.id = :projectId', { projectId })
      .getRawOne<{ organization_id: string }>();

    if (!row) throw new NotFoundException('Project not found');
    if (row.organization_id !== organizationId) {
      throw new ForbiddenException('Access denied');
    }
  }

  // --- Collecte ------------------------------------------------------------

  private async collectObservations(): Promise<CostObservation[]> {
    const lists = await this.shoppingListRepo.find({
      where: { budget_summary_json: Not(IsNull()) },
    });
    if (lists.length === 0) return [];

    const estimations = await this.estimationRepo.find({
      where: { id: In([...new Set(lists.map((l) => l.estimation_id))]) },
    });
    const estimationById = new Map(estimations.map((e) => [e.id, e]));
    const orgByProjectId = await this.loadOrganizationIds(
      lists.map((l) => l.project_id),
    );

    const observations: CostObservation[] = [];

    for (const list of lists) {
      const estimation = estimationById.get(list.estimation_id);
      const organizationId = orgByProjectId.get(list.project_id);
      // Pas d'organisation résolue = projet supprimé : il sort de la cohorte.
      if (!estimation || !organizationId) continue;

      const costs = this.extractWorkTypeCosts(list, estimation.items_json);
      if (!costs) continue;

      const observedAt = this.resolveObservedAt(list);
      for (const entry of costs) {
        observations.push({
          work_type_code: entry.work_type_code,
          surface_m2: entry.surface_m2,
          cost_per_m2: entry.cost / entry.surface_m2,
          organization_id: organizationId,
          observed_at: observedAt,
        });
      }
    }

    return observations;
  }

  /**
   * Coût matériaux et surface, par type d'ouvrage, pour un chantier.
   *
   * Retourne `null` quand le chantier n'est **pas attribuable** : un matériau
   * dont les lignes d'estimation relèvent de plusieurs types d'ouvrage, ou une
   * ligne d'achat sans ligne d'estimation correspondante. Ranger ces coûts au
   * hasard dans un ouvrage — ou les laisser tomber — sous-estimerait un ouvrage
   * et ferait paraître le chantier moins cher qu'il n'est : précisément le
   * chiffre que l'on publie (même parti pris que DATA-3, avec un enjeu de plus).
   *
   * Les consommables (`complementary_items`) sont exclus : ils ne portent aucun
   * type d'ouvrage. L'exclusion vaut des deux côtés de la comparaison, cohorte
   * comprise, donc elle ne biaise pas l'écart — elle en restreint le périmètre,
   * ce que l'écran dit explicitement.
   */
  private extractWorkTypeCosts(
    shoppingList: ShoppingList,
    estimationItems: EstimationLineItem[],
  ): WorkTypeCost[] | null {
    const workTypeByMaterial = new Map<string, string>();
    const labelByWorkType = new Map<string, string>();
    for (const line of estimationItems) {
      const known = workTypeByMaterial.get(line.material_id);
      if (known !== undefined && known !== line.work_type_code) return null;
      workTypeByMaterial.set(line.material_id, line.work_type_code);
      labelByWorkType.set(line.work_type_code, line.work_type_label);
    }

    // Surface dédoublonnée par (pièce × work item) : sous-couche et finition
    // sont deux lignes d'estimation sur la *même* surface, la sommer telle
    // quelle la compterait deux fois et diviserait le coût au m² par deux.
    const surfaceByWorkType = new Map<string, number>();
    const countedWorkItems = new Set<string>();
    for (const line of estimationItems) {
      const key = `${line.room_id ?? ''}|${line.work_item_id}`;
      if (countedWorkItems.has(key)) continue;
      countedWorkItems.add(key);
      surfaceByWorkType.set(
        line.work_type_code,
        (surfaceByWorkType.get(line.work_type_code) ?? 0) + line.surface_m2,
      );
    }

    const costByWorkType = new Map<string, number>();
    const incompleteWorkTypes = new Set<string>();
    for (const item of shoppingList.items_json.material_items) {
      const workType = workTypeByMaterial.get(item.material_id);
      if (workType === undefined) return null;

      // DATA-5 : le coût publié est celui qui a été **engagé**, donc le prix
      // réel multiplié par la quantité réellement achetée. Sans déclaration,
      // on ne connaît que la quantité prévue : la publier sous le libellé
      // « coûts réels constatés » serait le même abus de langage que ce lot
      // corrige ailleurs. L'ouvrage est écarté, pas approximé.
      //
      // E1-8 : même référence de quantité que le tableau de bord budgétaire
      // (`costedUnits`), sous une exigence plus stricte — ici le repli sur la
      // quantité prévue est refusé, parce que ce chiffre part en cohorte
      // inter-organisations et non sous les yeux de qui l'a saisi.
      const costed = costedUnits(item);
      if (item.real_unit_price == null || !costed.is_declared) {
        // Un ouvrage partiellement chiffré paraîtrait moins cher qu'il n'est :
        // on l'écarte, sans écarter les autres ouvrages du chantier.
        incompleteWorkTypes.add(workType);
        continue;
      }
      costByWorkType.set(
        workType,
        (costByWorkType.get(workType) ?? 0) +
          item.real_unit_price * costed.units,
      );
    }

    const results: WorkTypeCost[] = [];
    for (const [workType, cost] of costByWorkType) {
      if (incompleteWorkTypes.has(workType)) continue;
      const surface = surfaceByWorkType.get(workType) ?? 0;
      if (surface <= 0 || cost <= 0) continue;
      results.push({
        work_type_code: workType,
        work_type_label: labelByWorkType.get(workType) ?? workType,
        cost,
        surface_m2: surface,
      });
    }
    return results;
  }

  /** Date de finalisation du budget ; repli sur la dernière écriture. */
  private resolveObservedAt(list: ShoppingList): Date {
    const computedAt = list.budget_summary_json?.computed_at;
    if (computedAt) {
      const parsed = new Date(computedAt);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return list.updated_at ?? new Date();
  }

  /**
   * `organization_id` des projets concernés, en une requête et **sans** charger
   * l'entité `Project` (`rooms` en `eager`). Sans `withDeleted` : un projet
   * effacé n'a plus à alimenter une statistique publiée.
   */
  private async loadOrganizationIds(
    projectIds: string[],
  ): Promise<Map<string, string>> {
    const unique = [...new Set(projectIds)];
    if (unique.length === 0) return new Map();

    const rows = await this.projectRepo
      .createQueryBuilder('project')
      .select('project.id', 'id')
      .addSelect('project.organization_id', 'organization_id')
      .where('project.id IN (:...projectIds)', { projectIds: unique })
      .getRawMany<{ id: string; organization_id: string }>();

    return new Map(rows.map((r) => [r.id, r.organization_id]));
  }

  // --- Persistance ---------------------------------------------------------

  /**
   * Écrit les cellules publiables et **retire** celles qui ne le sont plus.
   * Sans ce retrait, une médiane publiée une fois le resterait pour toujours :
   * cohorte réduite sous le k par des suppressions de comptes, et le chiffre
   * continuerait d'être servi. Retourne le nombre de retraits.
   */
  private async persist(
    cells: BenchmarkCell[],
    computedAt: Date,
  ): Promise<number> {
    const published = cells.filter((c) => c.status === 'published');
    const keptKeys = new Set(published.map(benchmarkCellKey));

    // Même raisonnement que `WasteLearningService.persist` — et ici l'enjeu est
    // plus lourd : la fenêtre entre le retrait et la réécriture sert des
    // médianes dont la cohorte n'a pas été revérifiée, c'est-à-dire exactement
    // ce que le seuil de k-anonymat existe pour empêcher. Le verrou est
    // transactionnel, donc relâché quoi qu'il arrive à la transaction.
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [
        COST_BENCHMARK_LOCK_KEY,
      ]);

      const repo = manager.getRepository(CostBenchmark);
      const existing = await repo.find();
      const stale = existing.filter(
        (row) => !keptKeys.has(benchmarkCellKey(row)),
      );
      if (stale.length > 0) {
        await repo.delete(stale.map((row) => row.id));
      }

      if (published.length > 0) {
        await repo.upsert(
          published.map((c) => ({
            work_type_code: c.work_type_code,
            surface_band: c.surface_band,
            median_cost_per_m2: c.median_cost_per_m2!,
            sample_size: c.sample_size,
            organization_count: c.organization_count,
            computed_at: computedAt,
          })),
          ['work_type_code', 'surface_band'],
        );
      }

      return stale.length;
    });
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
