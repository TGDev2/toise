import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { In, IsNull, Not, Repository } from 'typeorm';
import { ShoppingList } from '../shopping-lists/entities/shopping-list.entity';
import {
  EstimationLineItem,
  EstimationResult,
} from '../estimations/entities/estimation-result.entity';
import { Project } from '../projects/entities/project.entity';
import { WasteFactor } from '../materials/entities/waste-factor.entity';
import { LearnedWasteFactor } from '../materials/entities/learned-waste-factor.entity';
import {
  resolveWasteFactor,
  WasteFactorInput,
} from '../estimations/estimation-engine';
import {
  learnWasteFactors,
  wasteCellKey,
  WasteLearningOutcome,
  WasteLearningStatus,
  WasteObservation,
} from './waste-learning';

export interface WasteLearningRunSummary {
  /** Observations exploitables extraites des chantiers terminés. */
  observations: number;
  /** Cellules matériau × pose × niveau rencontrées. */
  cells: number;
  by_status: Record<WasteLearningStatus, number>;
  /** Lignes apprises supprimées faute de continuer à remplir les critères. */
  removed: number;
  computed_at: string;
}

/**
 * BACKLOG DATA-3 : recalcul périodique des facteurs de perte à partir des
 * écarts estimé/acheté réels. La méthode statistique et ses garde-fous vivent
 * dans `waste-learning.ts` (pur) ; ce service ne fait que collecter les
 * observations, résoudre la référence catalogue et persister le résultat.
 *
 * Source des observations : les listes d'achats dont le budget a été
 * **finalisé** (`budget_summary_json ≠ null`), donc les chantiers réellement
 * terminés. Sur une liste non finalisée, `units_needed` n'est bien souvent que
 * la valeur générée jamais relue : la compter reviendrait à apprendre du
 * moteur lui-même.
 */
@Injectable()
export class WasteLearningService {
  private readonly logger = new Logger(WasteLearningService.name);

  constructor(
    @InjectRepository(ShoppingList)
    private readonly shoppingListRepo: Repository<ShoppingList>,
    @InjectRepository(EstimationResult)
    private readonly estimationRepo: Repository<EstimationResult>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(WasteFactor)
    private readonly wasteFactorRepo: Repository<WasteFactor>,
    @InjectRepository(LearnedWasteFactor)
    private readonly learnedRepo: Repository<LearnedWasteFactor>,
  ) {}

  @Cron(CronExpression.EVERY_WEEK, { timeZone: 'Europe/Paris' })
  async runWeekly(): Promise<void> {
    try {
      const summary = await this.run();
      this.logger.log(
        `Facteurs de perte appris : ${summary.by_status.learned} cellule(s) sur ${summary.cells}, ${summary.observations} observation(s), ${summary.removed} retrait(s).`,
      );
    } catch (err) {
      // Un rejet non capturé dans un cron tuerait le process : on trace et on
      // laisse la passe suivante retenter (le calcul est idempotent).
      this.logger.error(
        `Échec du recalcul des facteurs de perte : ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async run(): Promise<WasteLearningRunSummary> {
    const observations = await this.collectObservations();
    const resolveBaseline = await this.buildBaselineResolver();
    const outcomes = learnWasteFactors(observations, resolveBaseline);
    const computedAt = new Date();

    const removed = await this.persist(outcomes, computedAt);

    const byStatus: Record<WasteLearningStatus, number> = {
      learned: 0,
      insufficient_volume: 0,
      too_dispersed: 0,
      no_change: 0,
    };
    for (const outcome of outcomes) byStatus[outcome.status]++;

    return {
      observations: observations.length,
      cells: outcomes.length,
      by_status: byStatus,
      removed,
      computed_at: computedAt.toISOString(),
    };
  }

  async findAll(): Promise<LearnedWasteFactor[]> {
    return this.learnedRepo.find({
      order: { computed_at: 'DESC', material_id: 'ASC' },
    });
  }

  // --- Collecte ------------------------------------------------------------

  private async collectObservations(): Promise<WasteObservation[]> {
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

    const observations: WasteObservation[] = [];

    for (const list of lists) {
      const estimation = estimationById.get(list.estimation_id);
      const organizationId = orgByProjectId.get(list.project_id);
      if (!estimation || !organizationId) continue;

      const observedAt = this.resolveObservedAt(list);
      // Une liste antérieure à la mutualisation ENG-2 porte une ligne par
      // (pièce × work item) : le même matériau y apparaît plusieurs fois et
      // pèserait autant de fois dans la cellule. Un chantier = une observation
      // par matériau.
      const seenMaterialIds = new Set<string>();

      for (const item of list.items_json.material_items) {
        if (seenMaterialIds.has(item.material_id)) continue;
        // Un achat nul n'est pas une perte nulle : c'est un matériau
        // finalement écarté du chantier, hors sujet pour l'apprentissage.
        if (item.original_units_needed <= 0 || item.units_needed <= 0) continue;

        const context = this.resolveLineContext(
          estimation.items_json,
          item.material_id,
        );
        if (!context) continue;

        seenMaterialIds.add(item.material_id);
        observations.push({
          material_id: item.material_id,
          pose_type: context.pose_type,
          skill_level: estimation.skill_level,
          applied_percent: context.applied_percent,
          estimated_units: item.original_units_needed,
          actual_units: item.units_needed,
          organization_id: organizationId,
          observed_at: observedAt,
        });
      }
    }

    return observations;
  }

  /**
   * Ligne d'achat mutualisée (ENG-2) → pose et facteur appliqué. Une même
   * ligne peut agréger plusieurs pièces : si elles ne partagent pas la même
   * pose ou le même facteur, l'écart constaté n'est attribuable à aucune
   * cellule en particulier et l'observation est écartée plutôt que rangée au
   * hasard dans l'une d'elles.
   */
  private resolveLineContext(
    lines: EstimationLineItem[],
    materialId: string,
  ): { pose_type: string; applied_percent: number } | null {
    const matching = lines.filter((l) => l.material_id === materialId);
    if (matching.length === 0) return null;

    const poses = new Set(matching.map((l) => l.pose_type));
    const percents = new Set(
      matching.map((l) => Number(l.waste_factor_percent)),
    );
    if (poses.size !== 1 || percents.size !== 1) return null;

    return {
      pose_type: [...poses][0],
      applied_percent: [...percents][0],
    };
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
   * l'entité `Project` : ses `rooms` sont en `eager`, les hydrater pour un seul
   * uuid ferait exploser la passe. `withDeleted` car un chantier terminé puis
   * archivé reste une observation valide.
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
      .withDeleted()
      .getRawMany<{ id: string; organization_id: string }>();

    return new Map(rows.map((r) => [r.id, r.organization_id]));
  }

  /**
   * Référence catalogue par cellule, résolue par la fonction **du moteur** :
   * une cellule sans ligne exacte hérite de la pose `standard`, puis du défaut
   * générique — exactement ce que l'utilisateur a subi lors de l'estimation.
   */
  private async buildBaselineResolver(): Promise<
    (cell: {
      material_id: string;
      pose_type: string;
      skill_level: string;
    }) => number
  > {
    const factors = await this.wasteFactorRepo.find();
    const byMaterial = new Map<string, WasteFactorInput[]>();
    for (const wf of factors) {
      const entry: WasteFactorInput = {
        pose_type: wf.pose_type,
        skill_level: wf.skill_level,
        factor_percent: Number(wf.factor_percent),
      };
      const group = byMaterial.get(wf.material_id);
      if (group) group.push(entry);
      else byMaterial.set(wf.material_id, [entry]);
    }

    return (cell) =>
      resolveWasteFactor(
        byMaterial.get(cell.material_id) ?? [],
        cell.pose_type,
        cell.skill_level,
      ).percent;
  }

  // --- Persistance ---------------------------------------------------------

  /**
   * Écrit les cellules apprises et **retire** celles qui ne le sont plus : sans
   * ce retrait, une valeur apprise une fois resterait appliquée pour toujours,
   * même après que les données l'aient désavouée. Retourne le nombre de
   * retraits.
   */
  private async persist(
    outcomes: WasteLearningOutcome[],
    computedAt: Date,
  ): Promise<number> {
    const learned = outcomes.filter((o) => o.status === 'learned');
    const keptKeys = new Set(learned.map(wasteCellKey));

    const existing = await this.learnedRepo.find();
    const stale = existing.filter((row) => !keptKeys.has(wasteCellKey(row)));
    if (stale.length > 0) {
      await this.learnedRepo.delete(stale.map((row) => row.id));
    }

    if (learned.length > 0) {
      await this.learnedRepo.upsert(
        learned.map((o) => ({
          material_id: o.material_id,
          pose_type: o.pose_type,
          skill_level: o.skill_level,
          factor_percent: o.factor_percent!,
          baseline_percent: o.baseline_percent,
          observed_percent: o.observed_percent!,
          sample_size: o.sample_size,
          computed_at: computedAt,
        })),
        ['material_id', 'pose_type', 'skill_level'],
      );
    }

    return stale.length;
  }
}
