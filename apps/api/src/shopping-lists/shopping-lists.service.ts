import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  ShoppingList,
  ShoppingListData,
  ShoppingListMaterialItem,
  ShoppingListComplementaryItem,
  BudgetSummary,
} from './entities/shopping-list.entity';
import { ComplementaryMaterial } from './entities/complementary-material.entity';
import { WorkType } from '../projects/entities/work-type.entity';
import { MaterialCatalog } from '../materials/entities/material-catalog.entity';
import { MaterialEcoEquivalence } from '../materials/entities/material-eco-equivalence.entity';
import {
  EcoItemDto,
  EcoSuggestionDto,
} from './dto/eco-suggestions-response.dto';
import { EstimationsService } from '../estimations/estimations.service';
import { ProjectsService } from '../projects/projects.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { LogbookService } from '../logbook/logbook.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
import { UpdateShoppingListDto } from './dto/update-shopping-list.dto';
import { CloseoutRequestDto } from './dto/closeout.dto';
import {
  computeCloseout,
  type CloseoutComplementaryInput,
  type CloseoutMaterialInput,
  type CloseoutSummary,
} from './closeout';
import { computeBudgetSummary } from './budget-summary';
import type { EstimationLineItem } from '../estimations/entities/estimation-result.entity';
import { ProjectStatus } from '../projects/entities/project.entity';
import { isShareTokenExpired, shareTokenExpiry } from './share-token';

/**
 * Reporte les relevés de terrain — prix payé, enseigne, quantité réellement
 * achetée — de l'ancienne liste vers celle qui la remplace. Ce sont les seules
 * données que l'utilisateur a saisies lui-même : les recalculer est impossible,
 * les perdre est définitif.
 *
 * Les compléments sont repris au même titre que les matériaux. Ils ne l'étaient
 * pas, ce qui devient intenable dès lors que la finalisation exige un prix sur
 * chacun d'eux (cf. `finalizeBudgetSummary`) : une régénération aurait imposé de
 * ressaisir tout le second bloc.
 *
 * DATA-5 : les quantités déclarées voyagent avec les prix. Une régénération
 * après la clôture — un coup de « Régénérer » malencontreux — effacerait sinon
 * la seule donnée que ce lot existe pour collecter.
 */
function carryOverFieldRecords(
  previous: ShoppingListData,
  next: ShoppingListData,
): void {
  const materialsById = new Map(
    previous.material_items.map((item) => [item.material_id, item]),
  );
  for (const item of next.material_items) {
    const before = materialsById.get(item.material_id);
    if (!before) continue;
    if (before.real_unit_price != null) {
      item.real_unit_price = before.real_unit_price;
    }
    if (before.store_name != null) {
      item.store_name = before.store_name;
    }
    if (before.purchased_units != null) {
      item.purchased_units = before.purchased_units;
    }
  }

  const complementsById = new Map(
    previous.complementary_items.map((item) => [
      item.complementary_material_id,
      item,
    ]),
  );
  for (const item of next.complementary_items) {
    const before = complementsById.get(item.complementary_material_id);
    if (!before) continue;
    if (before.real_unit_price != null) {
      item.real_unit_price = before.real_unit_price;
    }
    if (before.store_name != null) {
      item.store_name = before.store_name;
    }
    if (before.purchased_quantity != null) {
      item.purchased_quantity = before.purchased_quantity;
    }
  }
}

@Injectable()
export class ShoppingListsService {
  constructor(
    @InjectRepository(ShoppingList)
    private readonly shoppingListRepo: Repository<ShoppingList>,
    @InjectRepository(ComplementaryMaterial)
    private readonly complementaryRepo: Repository<ComplementaryMaterial>,
    @InjectRepository(WorkType)
    private readonly workTypeRepo: Repository<WorkType>,
    @InjectRepository(MaterialCatalog)
    private readonly materialCatalogRepo: Repository<MaterialCatalog>,
    @InjectRepository(MaterialEcoEquivalence)
    private readonly ecoEquivalenceRepo: Repository<MaterialEcoEquivalence>,
    private readonly estimationsService: EstimationsService,
    private readonly projectsService: ProjectsService,
    private readonly analyticsService: AnalyticsService,
    private readonly logbookService: LogbookService,
  ) {}

  async getOrGenerate(
    projectId: string,
    organizationId: string,
    userId: string,
  ): Promise<{ shoppingList: ShoppingList; latestEstimationId: string }> {
    await this.projectsService.findOneForOrg(projectId, organizationId);

    const latest = await this.estimationsService.getLatest(
      projectId,
      organizationId,
    );

    const existing = await this.shoppingListRepo.findOne({
      where: { project_id: projectId },
    });

    if (existing) {
      return { shoppingList: existing, latestEstimationId: latest.id };
    }

    const generated = await this.generate(projectId, organizationId, userId);
    return { shoppingList: generated, latestEstimationId: latest.id };
  }

  async generate(
    projectId: string,
    organizationId: string,
    userId: string,
  ): Promise<ShoppingList> {
    return this.buildAndPersist(projectId, organizationId, userId, false);
  }

  /**
   * Construit la liste depuis la dernière estimation, puis l'écrit.
   *
   * Les lectures (estimation, types de travaux, compléments, contexte carrelage)
   * restent hors transaction : seule la persistance a besoin d'être atomique.
   */
  private async buildAndPersist(
    projectId: string,
    organizationId: string,
    userId: string,
    preserveRealPrices: boolean,
  ): Promise<ShoppingList> {
    const latest = await this.estimationsService.getLatest(
      projectId,
      organizationId,
    );

    // Build work_type_code → category map
    const codes = [
      ...new Set(latest.items_json.map((item) => item.work_type_code)),
    ];
    const workTypes = await this.workTypeRepo.find({
      where: { code: In(codes) },
    });
    const categoryByCode = new Map(
      workTypes.map((wt) => [wt.code, wt.category]),
    );

    // Lignes d'achat mutualisées (ENG-2) : 1 ligne par matériau, sommée sur
    // toutes les pièces, conditionnement choisi une seule fois (aggregated_json).
    // Repli sur le mapping 1:1 pour les estimations antérieures (null).
    const materialItems: ShoppingListMaterialItem[] = latest.aggregated_json
      ? latest.aggregated_json.map((agg) => ({
          material_id: agg.material_id,
          work_type_code: agg.work_type_code,
          work_type_label: agg.work_type_label,
          material_name: agg.material_name,
          material_category: categoryByCode.get(agg.work_type_code) || 'other',
          material_unit: agg.material_unit,
          packaging_label: agg.packaging_label,
          packaging_qty_per_unit: agg.packaging_qty_per_unit,
          adjusted_qty: agg.total_adjusted_qty,
          original_units_needed: agg.units_needed,
          units_needed: agg.units_needed,
          packaging_breakdown: agg.packaging_breakdown,
          is_manually_adjusted: false,
          room_count: agg.room_count,
          units_needed_low: agg.units_needed_low,
          units_needed_high: agg.units_needed_high,
        }))
      : latest.items_json.map((item) => ({
          material_id: item.material_id,
          work_item_id: item.work_item_id,
          work_type_code: item.work_type_code,
          work_type_label: item.work_type_label,
          material_name: item.material_name,
          material_category: categoryByCode.get(item.work_type_code) || 'other',
          material_unit: item.material_unit,
          packaging_label: item.packaging_label,
          packaging_qty_per_unit: item.packaging_qty_per_unit,
          adjusted_qty: item.adjusted_qty,
          original_units_needed: item.units_needed,
          units_needed: item.units_needed,
          packaging_breakdown: item.packaging_breakdown,
          is_manually_adjusted: false,
          units_needed_low: item.units_needed_low,
          units_needed_high: item.units_needed_high,
        }));

    // Fetch complementary materials for relevant categories
    const categories = [...new Set(categoryByCode.values())];
    const complements = await this.complementaryRepo.find({
      where: { category: In(categories) },
      order: { category: 'ASC', display_order: 'ASC' },
    });

    // E1-6 : un complément est un forfait, et rien d'autre. Ce qui se calcule
    // sur la géométrie — colle, joint, croisillons — est un matériau du
    // catalogue, chiffré par le moteur avec son rendement, son facteur de perte
    // et son conditionnement. Le calculer ici en doublait la ligne.
    const complementaryItems: ShoppingListComplementaryItem[] = complements.map(
      (c) => ({
        complementary_material_id: c.id,
        name: c.name,
        description_fr: c.description_fr,
        category: c.category,
        unit_label: c.unit_label,
        default_quantity: c.default_quantity,
        quantity: c.default_quantity,
        is_removed: false,
      }),
    );

    const data: ShoppingListData = {
      material_items: materialItems,
      complementary_items: complementaryItems,
    };

    const saved = await this.shoppingListRepo.manager.transaction((manager) =>
      this.persistGeneratedLocked(
        manager,
        projectId,
        latest.id,
        data,
        preserveRealPrices,
      ),
    );

    // Se déclenche aussi depuis regenerate() (régénération manuelle) : c'est
    // volontaire, le funnel agrège en aval sur la première occurrence par projet.
    this.analyticsService.track(
      AnalyticsEventName.SHOPPING_LIST_GENERATED,
      userId,
      {
        project_id: projectId,
        total_items: materialItems.length,
      },
    );

    return saved;
  }

  /**
   * Écrit la liste régénérée **en place**, sous le verrou de la ligne existante.
   *
   * C'était un `DELETE` suivi d'un `INSERT`, hors transaction : une panne entre
   * les deux ne laissait plus de liste du tout, et la régénération manuelle
   * restaurait ensuite les prix dans une *troisième* écriture, elle aussi
   * perdable. Trois écritures pour un seul fait.
   *
   * Conserver la ligne plutôt que la remplacer donne en prime la sérialisation
   * face à `update()` : les deux chemins verrouillent désormais la même ligne.
   * Détruire puis recréer laissait `update()` verrouiller une ligne condamnée —
   * un verrou qui ne protégeait rien. Le jeton de partage survit du même coup à
   * une régénération : un lien déjà transmis au client cessait de fonctionner
   * sans que personne ne l'ait demandé.
   */
  private async persistGeneratedLocked(
    manager: EntityManager,
    projectId: string,
    estimationId: string,
    data: ShoppingListData,
    preserveRealPrices: boolean,
  ): Promise<ShoppingList> {
    // Sérialise les créations concurrentes de la même liste : le front tire
    // `GET /shopping-list` et `GET /shopping-list/buy-links` en `Promise.all`
    // au premier chargement de la page, et les deux passent par
    // `getOrGenerate`. Sans ce verrou, sur un projet sans liste encore, les
    // deux `findOne` ci-dessous voient `null` — `FOR UPDATE` ne verrouille
    // aucune ligne quand il n'y en a pas — et les deux tentent l'INSERT ; le
    // second viole `UQ_shopping_lists_project`. Verrou transactionnel : la
    // seconde transaction attend ici que la première committe, puis relit et
    // trouve la ligne déjà créée.
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      projectId,
    ]);

    const existing = await manager.findOne(ShoppingList, {
      where: { project_id: projectId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!existing) {
      return manager.save(
        manager.create(ShoppingList, {
          project_id: projectId,
          estimation_id: estimationId,
          items_json: data,
        }),
      );
    }

    if (preserveRealPrices) {
      carryOverFieldRecords(existing.items_json, data);
    }

    existing.estimation_id = estimationId;
    existing.items_json = data;
    // Le résumé finalisé décrivait l'ancienne liste : il ne décrit plus
    // celle-ci. `getBudgetSummary` s'appuie sur cette remise à zéro (COM-1).
    existing.budget_summary_json = null;
    return manager.save(existing);
  }

  async update(
    projectId: string,
    organizationId: string,
    dto: UpdateShoppingListDto,
  ): Promise<{ shoppingList: ShoppingList; latestEstimationId: string }> {
    await this.projectsService.findOneForOrg(projectId, organizationId);

    // `items_json` est **une seule colonne** : toute correction de ligne est une
    // lecture-modification-écriture du blob entier. Sans verrou, deux PATCH
    // simultanés sur deux lignes différentes (deux onglets, ou deux compagnons
    // sur le même chantier) relisent la même version et le second écrase la
    // correction du premier — sans erreur, sans trace. Le verrou de ligne
    // sérialise les deux : le second repart de ce que le premier a écrit.
    // Couvert par `test/integration/persistence.int-spec.ts`.
    const saved = await this.shoppingListRepo.manager.transaction((manager) =>
      this.applyUpdateLocked(manager, projectId, dto),
    );

    const latest = await this.estimationsService.getLatest(
      projectId,
      organizationId,
    );
    return { shoppingList: saved, latestEstimationId: latest.id };
  }

  /** Corps transactionnel de `update` : la liste est verrouillée le temps du merge. */
  private async applyUpdateLocked(
    manager: EntityManager,
    projectId: string,
    dto: UpdateShoppingListDto,
  ): Promise<ShoppingList> {
    const shoppingList = await manager.findOne(ShoppingList, {
      where: { project_id: projectId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!shoppingList) {
      throw new NotFoundException(
        'No shopping list found for this project. Generate one first.',
      );
    }

    const data = shoppingList.items_json;

    // Merge material item updates (mutualisé : matching par material_id seul)
    if (dto.material_items) {
      for (const update of dto.material_items) {
        const item = data.material_items.find(
          (m) => m.material_id === update.material_id,
        );
        if (item) {
          item.units_needed = update.units_needed;
          item.is_manually_adjusted =
            update.units_needed !== item.original_units_needed;
          if (update.real_unit_price !== undefined) {
            item.real_unit_price = update.real_unit_price;
          }
          if (update.store_name !== undefined) {
            item.store_name = update.store_name;
          }
        }
      }
    }

    // Merge complementary item updates
    if (dto.complementary_items) {
      for (const update of dto.complementary_items) {
        const item = data.complementary_items.find(
          (c) =>
            c.complementary_material_id === update.complementary_material_id,
        );
        if (item) {
          if (update.quantity !== undefined) {
            item.quantity = update.quantity;
          }
          if (update.is_removed !== undefined) {
            item.is_removed = update.is_removed;
          }
          if (update.real_unit_price !== undefined) {
            item.real_unit_price = update.real_unit_price;
          }
          if (update.store_name !== undefined) {
            item.store_name = update.store_name;
          }
        }
      }
    }

    shoppingList.items_json = data;
    return manager.save(shoppingList);
  }

  async regenerate(
    projectId: string,
    organizationId: string,
    userId: string,
  ): Promise<{ shoppingList: ShoppingList; latestEstimationId: string }> {
    await this.projectsService.findOneForOrg(projectId, organizationId);

    // Relevés de prix et régénération dans la même écriture verrouillée :
    // cf. `persistGeneratedLocked`.
    const shoppingList = await this.buildAndPersist(
      projectId,
      organizationId,
      userId,
      true,
    );

    return { shoppingList, latestEstimationId: shoppingList.estimation_id };
  }

  async getBudgetSummary(
    projectId: string,
    organizationId: string,
  ): Promise<{ summary: BudgetSummary; isFinalized: boolean }> {
    await this.projectsService.findOneForOrg(projectId, organizationId);

    const shoppingList = await this.shoppingListRepo.findOne({
      where: { project_id: projectId },
    });

    if (!shoppingList) {
      throw new NotFoundException('No shopping list found for this project.');
    }

    const estimation = await this.estimationsService.findById(
      shoppingList.estimation_id,
    );

    return {
      summary: computeBudgetSummary(
        shoppingList.items_json,
        estimation.items_json,
      ),
      // COM-1 : regenerate() peut effacer budget_summary_json sur un projet
      // deja COMPLETED (prix restaures, resume non recalcule) — le live
      // recompute ci-dessus ne suffit pas a distinguer ce cas d'un budget
      // reellement finalise. Les appelants (ex. partage communaute) doivent
      // se fier a isFinalized, pas a summary.is_complete.
      isFinalized: shoppingList.budget_summary_json != null,
    };
  }

  async getEcoSuggestions(
    projectId: string,
    organizationId: string,
  ): Promise<{ eco_items: EcoItemDto[]; suggestions: EcoSuggestionDto[] }> {
    await this.projectsService.findOneForOrg(projectId, organizationId);

    const shoppingList = await this.shoppingListRepo.findOne({
      where: { project_id: projectId },
    });

    if (!shoppingList) {
      throw new NotFoundException('No shopping list found for this project.');
    }

    const materialIds = [
      ...new Set(
        shoppingList.items_json.material_items.map((i) => i.material_id),
      ),
    ];
    if (materialIds.length === 0) {
      return { eco_items: [], suggestions: [] };
    }

    const materials = await this.materialCatalogRepo.find({
      where: { id: In(materialIds) },
    });
    const materialById = new Map(materials.map((m) => [m.id, m]));

    const eco_items: EcoItemDto[] = materials
      .filter((m) => m.is_eco)
      .map((m) => ({
        material_id: m.id,
        material_name: m.name,
        eco_label_fr: m.eco_label_fr,
      }));

    const standardIds = materials.filter((m) => !m.is_eco).map((m) => m.id);
    let suggestions: EcoSuggestionDto[] = [];
    if (standardIds.length > 0) {
      const equivalences = await this.ecoEquivalenceRepo.find({
        where: { standard_material_id: In(standardIds) },
        relations: ['ecoMaterial'],
      });
      suggestions = equivalences
        // N'affiche pas une alternative désactivée entre-temps par l'admin.
        .filter((e) => e.ecoMaterial.is_active)
        .map((e) => ({
          material_id: e.standard_material_id,
          material_name: materialById.get(e.standard_material_id)?.name ?? '',
          eco_material_id: e.eco_material_id,
          eco_material_name: e.ecoMaterial.name,
          eco_label_fr: e.ecoMaterial.eco_label_fr,
        }));
    }

    return { eco_items, suggestions };
  }

  /**
   * Fige le budget réel et déclare le chantier terminé, sans déclaration
   * d'achats — le chemin historique, conservé pour les clients de l'API.
   * L'écran produit passe désormais par `recordCloseout`, qui déclare puis
   * clôture en une transaction.
   *
   * Lecture verrouillée, résumé et passage `COMPLETED` sont **une seule
   * transaction** : « le budget est finalisé » et « le projet est terminé »
   * sont deux façons de dire le même fait, et le partage communauté les lit
   * ensemble. C'étaient deux écritures indépendantes, dont l'une pouvait
   * aboutir sans l'autre.
   */
  async finalizeBudgetSummary(
    projectId: string,
    organizationId: string,
    userId: string,
  ): Promise<BudgetSummary> {
    await this.projectsService.findOneForOrg(projectId, organizationId);

    const { summary, shoppingList, estimation } =
      await this.shoppingListRepo.manager.transaction((manager) =>
        this.completeChantierLocked(manager, projectId),
      );

    await this.recordCompletionSideEffects(
      projectId,
      organizationId,
      userId,
      estimation,
      shoppingList,
      summary,
    );

    return summary;
  }

  /**
   * Corps verrouillé de la clôture : calcule le résumé, le fige et déclare le
   * projet terminé. Unique chemin de passage à `COMPLETED` — `finalize` comme
   * `recordCloseout` passent par ici, pour qu'il n'existe pas deux définitions
   * concurrentes de « le chantier est fini ».
   *
   * DATA-5 : la finalisation n'exige plus que **tout** soit tarifé. Elle le
   * faisait, et c'est ce qui rendait la boucle infermable — un seul sachet de
   * croisillons sans prix bloquait la clôture, donc le carnet, le benchmark,
   * les facteurs de perte appris et le partage communauté. Ce que la clôture
   * demande, ce sont les **quantités** ; les prix restent facultatifs.
   *
   * L'invariant que gardait ce contrôle est conservé ailleurs, et mieux :
   * `is_complete` dit toujours la vérité sur le tarifage, et c'est lui que
   * `CommunityService.submitProject` exige avant de publier un total. Un
   * budget partiel est donc persistable, mais reste impubliable.
   */
  private async completeChantierLocked(
    manager: EntityManager,
    projectId: string,
  ): Promise<{
    summary: BudgetSummary;
    shoppingList: ShoppingList;
    estimation: Awaited<ReturnType<EstimationsService['findById']>>;
  }> {
    const shoppingList = await manager.findOne(ShoppingList, {
      where: { project_id: projectId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!shoppingList) {
      throw new NotFoundException('No shopping list found for this project.');
    }

    const estimation = await this.estimationsService.findById(
      shoppingList.estimation_id,
    );

    const summary = computeBudgetSummary(
      shoppingList.items_json,
      estimation.items_json,
    );

    shoppingList.budget_summary_json = summary;
    await manager.save(shoppingList);

    await this.projectsService.updateStatus(
      projectId,
      ProjectStatus.COMPLETED,
      manager,
    );

    return { summary, shoppingList, estimation };
  }

  /**
   * Effets hors transaction de la clôture.
   *
   * Le carnet du logement reste **hors** transaction : il fait ses propres
   * lectures (pièces, dimensions) et son écriture est un upsert sur
   * `(project_id, room_id)` — une re-clôture le rejoue sans doublon. Le faire
   * entrer dans la transaction demanderait de propager le manager dans
   * `LogbookService` et `ProjectsService.getRooms` pour un gain nul.
   */
  private async recordCompletionSideEffects(
    projectId: string,
    organizationId: string,
    userId: string,
    estimation: Awaited<ReturnType<EstimationsService['findById']>>,
    shoppingList: ShoppingList,
    summary: BudgetSummary,
  ): Promise<void> {
    // PLAT-1 : instantané par pièce (dimensions validées, matériaux
    // réellement achetés) — même point d'ancrage que le partage communauté
    // (COM-1/COM-2), seul moment garanti où prix réels ET dimensions sont
    // connus pour tout utilisateur.
    await this.logbookService.recordChantierCompletion(
      projectId,
      organizationId,
      userId,
      estimation,
      shoppingList,
    );

    this.analyticsService.track(AnalyticsEventName.BUDGET_TRACKED, userId, {
      project_id: projectId,
      savings_amount: summary.savings_amount,
      savings_percent: summary.savings_percent,
    });
  }

  /**
   * Prépare l'écran de clôture : une ligne par article, pré-remplie de la
   * quantité estimée, plus ce que la déclaration en cours permet déjà de dire.
   */
  async getCloseout(
    projectId: string,
    organizationId: string,
    today: string = new Date().toISOString().slice(0, 10),
  ): Promise<{
    closeout: CloseoutSummary;
    budgetSummary: BudgetSummary | null;
    isFinalized: boolean;
  }> {
    await this.projectsService.findOneForOrg(projectId, organizationId);

    const shoppingList = await this.shoppingListRepo.findOne({
      where: { project_id: projectId },
    });

    if (!shoppingList) {
      throw new NotFoundException('No shopping list found for this project.');
    }

    const estimation = await this.estimationsService.findById(
      shoppingList.estimation_id,
    );

    return this.buildCloseoutView(shoppingList, estimation.items_json, today);
  }

  /**
   * Enregistre les quantités réellement achetées et clôture le chantier.
   *
   * Déclaration et clôture partagent une transaction et un verrou : sans cela,
   * un `PATCH` concurrent pourrait glisser entre les deux et le résumé figé
   * décrirait une liste que l'utilisateur n'a pas déclarée.
   *
   * Aucun prix n'est exigé. C'est le cœur du lot : la clôture rend un service
   * (ce qui reste, ce qui se rend, l'écart avec l'estimation) contre une seule
   * correction par ligne, là où la finalisation réclamait une saisie complète
   * sans rien donner en retour.
   */
  async recordCloseout(
    projectId: string,
    organizationId: string,
    userId: string,
    dto: CloseoutRequestDto,
    today: string = new Date().toISOString().slice(0, 10),
  ): Promise<{
    closeout: CloseoutSummary;
    budgetSummary: BudgetSummary | null;
    isFinalized: boolean;
  }> {
    await this.projectsService.findOneForOrg(projectId, organizationId);

    const { summary, shoppingList, estimation } =
      await this.shoppingListRepo.manager.transaction(async (manager) => {
        await this.applyDeclarationsLocked(manager, projectId, dto);
        return this.completeChantierLocked(manager, projectId);
      });

    await this.recordCompletionSideEffects(
      projectId,
      organizationId,
      userId,
      estimation,
      shoppingList,
      summary,
    );

    const view = this.buildCloseoutView(
      shoppingList,
      estimation.items_json,
      today,
    );

    this.analyticsService.track(AnalyticsEventName.PROJECT_CLOSED_OUT, userId, {
      project_id: projectId,
      lines_declared: view.closeout.lines_declared,
      lines_total: view.closeout.lines_total,
      surplus_value_total: view.closeout.surplus_value_total,
      recoverable_amount: view.closeout.recoverable_amount,
    });

    return { ...view, isFinalized: true };
  }

  /** Corps transactionnel de `recordCloseout` : merge des quantités déclarées. */
  private async applyDeclarationsLocked(
    manager: EntityManager,
    projectId: string,
    dto: CloseoutRequestDto,
  ): Promise<void> {
    const shoppingList = await manager.findOne(ShoppingList, {
      where: { project_id: projectId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!shoppingList) {
      throw new NotFoundException(
        'No shopping list found for this project. Generate one first.',
      );
    }

    const data = shoppingList.items_json;

    for (const declaration of dto.material_items ?? []) {
      const item = data.material_items.find(
        (m) => m.material_id === declaration.material_id,
      );
      if (item) {
        item.purchased_units = declaration.purchased_units;
      }
    }

    for (const declaration of dto.complementary_items ?? []) {
      const item = data.complementary_items.find(
        (c) =>
          c.complementary_material_id === declaration.complementary_material_id,
      );
      if (item) {
        item.purchased_quantity = declaration.purchased_quantity;
      }
    }

    if (dto.purchased_on !== undefined) {
      shoppingList.purchased_on = dto.purchased_on.slice(0, 10);
    }

    shoppingList.items_json = data;
    await manager.save(shoppingList);
  }

  /**
   * Assemble les entrées du module pur à partir de la liste et de l'estimation.
   *
   * Le besoin net et le facteur de perte viennent de l'estimation, pas de la
   * liste : la liste ne porte que le résultat arrondi au conditionnement.
   * Un matériau dont les lignes d'estimation portent plusieurs facteurs de
   * perte ne se voit attribuer aucun taux — la même discipline que
   * `WasteLearningService`, pour la même raison : une moyenne de deux poses
   * différentes ne décrit ni l'une ni l'autre.
   */
  private buildCloseoutView(
    shoppingList: ShoppingList,
    estimationItems: EstimationLineItem[],
    today: string,
  ): {
    closeout: CloseoutSummary;
    budgetSummary: BudgetSummary | null;
    isFinalized: boolean;
  } {
    const stats = new Map<
      string,
      { theoretical: number; percents: Set<number> }
    >();
    for (const line of estimationItems) {
      const entry = stats.get(line.material_id) ?? {
        theoretical: 0,
        percents: new Set<number>(),
      };
      entry.theoretical += line.theoretical_qty;
      entry.percents.add(line.waste_factor_percent);
      stats.set(line.material_id, entry);
    }

    const materials: CloseoutMaterialInput[] =
      shoppingList.items_json.material_items.map((item) => {
        const stat = stats.get(item.material_id);
        return {
          material_id: item.material_id,
          material_name: item.material_name,
          material_category: item.material_category,
          material_unit: item.material_unit,
          packaging_label: item.packaging_label,
          packaging_qty_per_unit: item.packaging_qty_per_unit,
          estimated_units: item.original_units_needed,
          purchased_units: item.purchased_units ?? null,
          real_unit_price: item.real_unit_price ?? null,
          store_name: item.store_name ?? null,
          theoretical_qty: stat ? stat.theoretical : null,
          estimated_waste_percent:
            stat && stat.percents.size === 1 ? [...stat.percents][0] : null,
        };
      });

    const complementaries: CloseoutComplementaryInput[] =
      shoppingList.items_json.complementary_items
        .filter((item) => !item.is_removed)
        .map((item) => ({
          complementary_material_id: item.complementary_material_id,
          name: item.name,
          unit_label: item.unit_label,
          estimated_quantity: item.quantity,
          purchased_quantity: item.purchased_quantity ?? null,
          real_unit_price: item.real_unit_price ?? null,
          store_name: item.store_name ?? null,
        }));

    const summary = computeBudgetSummary(
      shoppingList.items_json,
      estimationItems,
    );

    return {
      closeout: computeCloseout(
        materials,
        complementaries,
        shoppingList.purchased_on,
        today,
      ),
      // Un budget sans aucun prix connu n'est pas un budget : le rendre à zéro
      // ferait afficher « 0 EUR dépensé » à qui n'a rien saisi.
      budgetSummary: summary.items_priced > 0 ? summary : null,
      isFinalized: shoppingList.budget_summary_json != null,
    };
  }

  async generateShareToken(
    projectId: string,
    organizationId: string,
  ): Promise<{ share_token: string; expires_at: string }> {
    await this.projectsService.findOneForOrg(projectId, organizationId);

    const shoppingList = await this.shoppingListRepo.findOne({
      where: { project_id: projectId },
    });

    if (!shoppingList) {
      throw new NotFoundException(
        'No shopping list found for this project. Generate one first.',
      );
    }

    // Un jeton encore valide est réutilisé — le lien déjà transmis au client
    // continue de fonctionner. Un jeton expiré est remplacé : le renvoyer
    // produirait une URL morte à l'instant même où on la génère.
    if (shoppingList.share_token && !isShareTokenExpired(shoppingList)) {
      return {
        share_token: shoppingList.share_token,
        expires_at: shareTokenExpiry(shoppingList)!.toISOString(),
      };
    }

    const token = randomBytes(32).toString('hex');
    shoppingList.share_token = token;
    shoppingList.share_token_created_at = new Date();
    await this.shoppingListRepo.save(shoppingList);

    return {
      share_token: token,
      expires_at: shareTokenExpiry(shoppingList)!.toISOString(),
    };
  }

  async revokeShareToken(
    projectId: string,
    organizationId: string,
  ): Promise<void> {
    await this.projectsService.findOneForOrg(projectId, organizationId);

    const shoppingList = await this.shoppingListRepo.findOne({
      where: { project_id: projectId },
    });

    if (!shoppingList) {
      throw new NotFoundException('No shopping list found for this project.');
    }

    shoppingList.share_token = null;
    shoppingList.share_token_created_at = null;
    await this.shoppingListRepo.save(shoppingList);
  }

  async findByShareToken(token: string): Promise<ShoppingList> {
    const shoppingList = await this.shoppingListRepo.findOne({
      where: { share_token: token },
      relations: ['project', 'project.rooms', 'project.rooms.dimensions'],
    });

    // Le message parlait déjà d'expiration alors qu'aucune ligne ne la
    // vérifiait : `share_token_created_at` était écrite puis jamais relue, et un
    // lien restait valable indéfiniment. Il expose sans authentification les
    // prix d'achat réels et les enseignes — exactement les données que le module
    // benchmark protège par ailleurs par k-anonymat.
    //
    // Le projet manquant est le second cas : `ShoppingList` n'a pas de
    // `@DeleteDateColumn`, la cascade FK ne se déclenche qu'à la suppression
    // physique, donc la liste survit à la suppression logique de son projet et
    // la relation revient à `null`. Sans cette garde, le contrôleur
    // déréférençait `project.name` et rendait un 500 là où un 404 est la
    // réponse juste.
    if (
      !shoppingList ||
      !shoppingList.project ||
      isShareTokenExpired(shoppingList)
    ) {
      throw new NotFoundException(
        'Shopping list not found or link has expired.',
      );
    }

    return shoppingList;
  }

  async saveEntity(entity: ShoppingList): Promise<ShoppingList> {
    return this.shoppingListRepo.save(entity);
  }
}
