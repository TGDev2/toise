import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AggregatedMaterialLine,
  EstimationLineItem,
  EstimationResult,
  MaterialExclusion,
} from './entities/estimation-result.entity';
import { EmailCapture } from './entities/email-capture.entity';
import { LearnedWasteFactor } from '../materials/entities/learned-waste-factor.entity';
import { WorkTypeMaterial } from '../materials/entities/work-type-material.entity';
import { overlayLearnedWasteFactors } from '../waste-learning/waste-learning';
import { ProjectsService } from '../projects/projects.service';
import {
  EstimationEngine,
  RoomData,
  WorkItemInput,
  MaterialInput,
  PackagingInput,
} from './estimation-engine';
import { SkillLevel } from '../projects/entities/project-work-item.entity';
import { ProjectStatus } from '../projects/entities/project.entity';
import { WorkType } from '../projects/entities/work-type.entity';
import {
  QuoteCoherenceStatus,
  WasteReferenceRange,
  classifyDeclared,
  dominantWasteReference,
  impliedWastePercent,
} from './quote-coherence';
import { resolveLayingPose } from './pose-types';
import { PublicEstimateRequestDto } from './dto/public-estimate-request.dto';
import { PublicQuoteCheckRequestDto } from './dto/public-quote-check-request.dto';
import { PublicEstimateEmailDto } from './dto/public-estimate-email.dto';
import { ApiEstimateRequestDto } from './dto/api-estimate-request.dto';
import { EmailService } from '../email/email.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';

/**
 * Nombre d'estimations qu'un compte invité peut faire persister sur un projet
 * (E2-1). Le parcours nominal en consomme 1 à 4 : un calcul à l'arrivée sur
 * l'écran, un par changement de niveau de compétence. Vingt laisse donc une
 * marge confortable à un usage réel tout en fermant la boucle infinie.
 *
 * Exporté pour que le test énonce *cette* valeur et non une copie.
 */
export const GUEST_ESTIMATION_LIMIT = 20;

export interface PublicEstimateResponse {
  work_type_code: string;
  work_type_label: string;
  skill_level: string;
  total_items: number;
  items: EstimationLineItem[];
  /**
   * E1-8 — matériaux que l'ouvrage ne demande pas, avec leur motif. Vide plutôt
   * qu'absent : « rien d'écarté » est une réponse, et l'écran l'affiche
   * différemment de « on ne sait pas ».
   */
  exclusions: MaterialExclusion[];
}

export interface PublicEstimateEmailResponse {
  sent: boolean;
}

/**
 * Réponse du contrôle de devis (GTM-10).
 *
 * **Aucun champ de prix, et c'est structurel** : la décision produit est que
 * Chiffréo mesure et n'arbitre pas. `quote-check-response.spec.ts` interdit à
 * cette interface toute clé de prix — le jour où quelqu'un voudra en ajouter une,
 * il devra d'abord rouvrir la décision, pas seulement le fichier.
 */
export interface PublicQuoteCheckResponse {
  work_type_code: string;
  work_type_label: string;
  surface_target: string;
  /** Surface avant déduction des ouvertures et des zones non traitées. */
  gross_surface_m2: number;
  /** Surface réellement à traiter — le terme de comparaison du devis. */
  net_surface_m2: number;
  deducted_m2: number;
  declared_surface_m2: number;
  /** `null` quand la pièce ne donne rien à comparer (surface nette nulle). */
  implied_waste_percent: number | null;
  reference: WasteReferenceRange;
  status: QuoteCoherenceStatus;
  /** Ce que la pièce demande, pour recouper les lignes matériaux du devis. */
  items: EstimationLineItem[];
  /**
   * E1-8 — et ce qu'elle **ne** demande pas. Un devis qui facture un
   * pare-vapeur sur un plancher bois est un écart que la seule comparaison de
   * surfaces ne peut pas voir.
   */
  exclusions: MaterialExclusion[];
}

/** Réponse de l'API publique (PLAT-5) : lignes détaillées + achats mutualisés. */
export interface ApiEstimateResponse {
  rooms_count: number;
  total_items: number;
  items: EstimationLineItem[];
  aggregated: AggregatedMaterialLine[];
  /** E1-8 — matériaux liés que l'ouvrage ne demande pas, avec leur motif. */
  exclusions: MaterialExclusion[];
}

@Injectable()
export class EstimationsService {
  private readonly logger = new Logger(EstimationsService.name);

  constructor(
    @InjectRepository(EstimationResult)
    private readonly estimationRepo: Repository<EstimationResult>,
    @InjectRepository(LearnedWasteFactor)
    private readonly learnedWasteFactorRepo: Repository<LearnedWasteFactor>,
    @InjectRepository(WorkTypeMaterial)
    private readonly workTypeMaterialsRepo: Repository<WorkTypeMaterial>,
    @InjectRepository(WorkType)
    private readonly workTypesRepo: Repository<WorkType>,
    @InjectRepository(EmailCapture)
    private readonly emailCaptureRepo: Repository<EmailCapture>,
    private readonly projectsService: ProjectsService,
    private readonly engine: EstimationEngine,
    private readonly emailService: EmailService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /**
   * Catalogue d'un ouvrage, prêt pour le moteur, avec les facteurs de perte
   * appris (DATA-3) superposés au catalogue de pertes. La superposition a lieu ici et
   * non dans le moteur : tout ce qui chiffre — application, calculateurs
   * publics, API PLAT-5, widget PLAT-7 — passe par cette méthode, et un moteur
   * qui resterait une fonction du seul catalogue qu'on lui donne demeure
   * testable sans base.
   *
   * E1-2 : la liaison est portée par `work_type_materials`, pas par la
   * catégorie — `wall_painting` et `ceiling_painting` partagent la catégorie
   * `painting` mais pas les mêmes matériaux. Une liaison `is_optional` est une
   * alternative documentée (E1-3), jamais chiffrée automatiquement.
   */
  private async loadMaterialInputs(
    workType: WorkType,
  ): Promise<MaterialInput[]> {
    const links = await this.workTypeMaterialsRepo.find({
      where: { work_type_id: workType.id, is_optional: false },
      relations: ['material', 'material.packagings', 'material.waste_factors'],
      order: { display_order: 'ASC' },
    });

    const activeLinks = links.filter(
      (l) =>
        l.material.is_active &&
        // PLAT-3 : les alternatives éco sont informationnelles (badge/
        // suggestion sur la liste de courses), jamais injectées dans le
        // chiffrage automatique — un matériau éco actif serait sinon ajouté
        // au chiffrage de tous les utilisateurs, Free inclus.
        !l.material.is_eco,
    );

    if (activeLinks.length === 0) return [];

    const learned = await this.learnedWasteFactorRepo.find({
      where: { material_id: In(activeLinks.map((l) => l.material.id)) },
    });
    const learnedByMaterialId = new Map<string, LearnedWasteFactor[]>();
    for (const lwf of learned) {
      const group = learnedByMaterialId.get(lwf.material_id);
      if (group) group.push(lwf);
      else learnedByMaterialId.set(lwf.material_id, [lwf]);
    }

    return activeLinks.map((l) => {
      const m = l.material;
      return {
        id: m.id,
        name: m.name,
        unit: m.unit,
        yield_per_unit: Number(m.yield_per_unit),
        applies_coats: m.applies_coats,
        // E1-3 : c'est ce champ qui dit dans quelle unité `yield_per_unit` est
        // exprimé, donc si la quantité suit le nombre de faces ou la trame.
        quantity_driver: m.quantity_driver,
        // E1-5 : et c'est celui-ci qui dit à quelle géométrie de carreau il est
        // exprimé, donc de combien il bouge avec le format posé.
        consumption_model: m.consumption_model,
        // E1-6 : et celui-ci le remplace tout à fait — un matériau vendu au
        // rouleau se compte en lés, pas au mètre carré. Les deux dimensions ne
        // valent qu'ensemble : une seule renseignée ne bascule rien.
        roll_spec:
          m.roll_width_cm && m.roll_length_cm
            ? {
                width_cm: Number(m.roll_width_cm),
                length_cm: Number(m.roll_length_cm),
              }
            : null,
        // E1-8 : et celui-ci ne dit rien de la quantité — il dit si la ligne a
        // lieu d'être. Un film pare-vapeur sur un plancher bois n'en a pas.
        vapour_barrier: m.vapour_barrier,
        // E1-8 : et celui-ci dit si l'achat se compte ou se divise.
        offcuts_reusable: m.offcuts_reusable,
        // E1-10 : deux autres décideurs de présence — le SEL suit l'exposition
        // à l'eau du local, le ragréage la planéité déclarée du support.
        wet_room_system: m.wet_room_system,
        substrate_prep: m.substrate_prep,
        role: l.role,
        waste_factors: overlayLearnedWasteFactors(
          m.waste_factors.map((wf) => ({
            pose_type: wf.pose_type,
            skill_level: wf.skill_level,
            factor_percent: Number(wf.factor_percent),
          })),
          learnedByMaterialId.get(m.id) ?? [],
        ),
        packagings: m.packagings.map((p) => ({
          label: p.label,
          quantity_per_unit: Number(p.quantity_per_unit),
          unit: p.unit,
        })),
      };
    });
  }

  /**
   * Traduction d'un ouvrage en entrée du moteur — **le seul endroit** où un
   * `WorkItemInput` se construit.
   *
   * Il y en avait trois (chantier, calculateur public, API multi-pièces), et le
   * champ ajouté à l'un aurait manqué aux deux autres. Ici l'omission n'est pas
   * possible : un ouvrage à assiette déclarée qui perdrait sa déclaration en
   * route ne retomberait pas en silence sur le périmètre de la pièce — il
   * lèverait, et c'est exactement le défaut que ce lot corrige.
   *
   * `declared` sans assiette complète est une donnée d'avant E1-2 (colonnes
   * `NULL`) ou un appel qui ne l'a pas fournie : c'est une demande invalide,
   * pas un cas à combler par un défaut plausible (leçon 18).
   */
  private toWorkItemInput(
    workType: WorkType,
    params: {
      id: string;
      skillLevel: SkillLevel;
      customParams: Record<string, unknown>;
      materials: MaterialInput[];
      declaredLengthM?: number | null;
      declaredHeightM?: number | null;
      declaredCladFaces?: number | null;
    },
  ): WorkItemInput {
    const base: WorkItemInput = {
      id: params.id,
      work_type_code: workType.code,
      work_type_label: workType.label_fr,
      category: workType.category,
      surface_target: workType.surface_target,
      skill_level: params.skillLevel,
      custom_params: params.customParams,
      materials: params.materials,
    };

    if (workType.quantity_basis !== 'declared') {
      return base;
    }

    const declared: Array<[string, number | null | undefined]> = [
      ['declared_length_m', params.declaredLengthM],
      ['declared_height_m', params.declaredHeightM],
      ['declared_clad_faces', params.declaredCladFaces],
    ];
    for (const [field, value] of declared) {
      if (value === undefined || value === null) {
        throw new BadRequestException(
          `Missing required parameter "${field}" for work type "${workType.code}"`,
        );
      }
    }

    return {
      ...base,
      declared_basis: {
        length_m: Number(params.declaredLengthM),
        height_m: Number(params.declaredHeightM),
        clad_faces: Number(params.declaredCladFaces),
      },
      frame_spec: workType.frame_spec,
    };
  }

  async estimate(
    projectId: string,
    organizationId: string,
    userId: string,
    skillLevelOverride?: SkillLevel,
    isGuest = false,
  ): Promise<EstimationResult> {
    // Chaque appel persiste une ligne, sans dédoublonnage ni purge : c'est la
    // seule écriture non bornée qu'un compte anonyme puisse déclencher (E2-1).
    // Le `@Throttle` de la route borne le débit **par IP** ; ce plafond-ci
    // borne le volume **par compte**, ce qu'une rotation d'adresses ne
    // contourne pas. Vérifié avant tout calcul : refuser après avoir dépensé
    // le CPU qu'on prétend économiser n'aurait aucun sens.
    if (isGuest) {
      const persisted = await this.estimationRepo.count({
        where: { project_id: projectId },
      });
      if (persisted >= GUEST_ESTIMATION_LIMIT) {
        throw new ForbiddenException({
          message:
            'Créez votre compte gratuit pour continuer à recalculer ce projet.',
          error: 'GUEST_ESTIMATE_LIMIT_REACHED',
          limit: GUEST_ESTIMATION_LIMIT,
        });
      }
    }

    const rooms = await this.projectsService.getRooms(
      projectId,
      organizationId,
    );

    // Une pièce est estimable si elle a des dimensions ET ≥ 1 work item.
    const estimableRooms = rooms.filter(
      (r) => r.dimensions && r.workItems && r.workItems.length > 0,
    );

    if (rooms.every((r) => !r.dimensions)) {
      throw new BadRequestException(
        'Project must have room dimensions before estimation',
      );
    }
    if (estimableRooms.length === 0) {
      throw new BadRequestException(
        'Project must have at least one work item before estimation',
      );
    }

    // Catalogue matériaux mis en cache par ouvrage : une seule requête par
    // ouvrage pour tout le projet, quel que soit le nombre de pièces. Par
    // ouvrage et non par catégorie (E1-2) — deux ouvrages d'une même
    // catégorie (ex. `wall_painting`/`ceiling_painting`) n'ont pas les mêmes
    // matériaux liés.
    const materialsByWorkTypeId = new Map<string, MaterialInput[]>();
    const loadMaterials = async (
      workType: WorkType,
    ): Promise<MaterialInput[]> => {
      const cached = materialsByWorkTypeId.get(workType.id);
      if (cached) return cached;
      const loaded = await this.loadMaterialInputs(workType);
      materialsByWorkTypeId.set(workType.id, loaded);
      return loaded;
    };

    const granularLines: EstimationLineItem[] = [];
    const granularExclusions: MaterialExclusion[] = [];
    const packagingByMaterialId = new Map<string, PackagingInput[]>();
    let firstSkillLevel: SkillLevel | undefined;

    for (const room of estimableRooms) {
      const dimensions = room.dimensions!;
      const roomData: RoomData = {
        length_cm: dimensions.length_cm,
        width_cm: dimensions.width_cm,
        height_cm: dimensions.height_cm,
        openings: (room.openings || []).map((o) => ({
          width_cm: o.width_cm,
          height_cm: o.height_cm,
          count: o.count,
          // E1-10 : la colonne est NOT NULL — ce chemin-là est exact.
          type: o.type,
        })),
        segments: dimensions.segments_json ?? undefined,
        exclusions: (dimensions.exclusions_json ?? []).map((e) => ({
          surface_target: e.surface_target,
          area_m2: e.area_m2,
        })),
        length_cm_uncertainty: dimensions.length_cm_uncertainty ?? undefined,
        width_cm_uncertainty: dimensions.width_cm_uncertainty ?? undefined,
        height_cm_uncertainty: dimensions.height_cm_uncertainty ?? undefined,
      };

      const workItemInputs: WorkItemInput[] = [];
      for (const wi of room.workItems) {
        const wt = wi.work_type;
        const materialInputs = await loadMaterials(wt);

        // Mémorise les conditionnements par matériau pour l'agrégation.
        for (const mat of materialInputs) {
          if (!packagingByMaterialId.has(mat.id)) {
            packagingByMaterialId.set(mat.id, mat.packagings);
          }
        }

        if (firstSkillLevel === undefined) firstSkillLevel = wi.skill_level;

        workItemInputs.push(
          this.toWorkItemInput(wt, {
            id: wi.id,
            skillLevel: skillLevelOverride || wi.skill_level,
            customParams: wi.custom_params,
            materials: materialInputs,
            declaredLengthM: wi.declared_length_m,
            declaredHeightM: wi.declared_height_m,
            declaredCladFaces: wi.declared_clad_faces,
          }),
        );
      }

      const { items, exclusions } = this.engine.computeEstimationDetailed(
        roomData,
        workItemInputs,
      );
      for (const line of items) {
        granularLines.push({
          ...line,
          room_id: room.id,
          room_name: room.name,
        });
      }
      // Même geste que pour les lignes : la pièce est attachée **après** le
      // moteur, qui ne la connaît pas. Un motif d'exclusion sans pièce serait
      // illisible sur un projet à plusieurs pièces aux supports différents.
      for (const exclusion of exclusions) {
        granularExclusions.push({
          ...exclusion,
          room_id: room.id,
          room_name: room.name,
        });
      }
    }

    const aggregated = this.engine.aggregatePurchases(
      granularLines,
      packagingByMaterialId,
    );

    const result = this.estimationRepo.create({
      project_id: projectId,
      skill_level:
        skillLevelOverride || firstSkillLevel || SkillLevel.INTERMEDIATE,
      items_json: granularLines,
      aggregated_json: aggregated,
      exclusions_json: granularExclusions,
      total_items: granularLines.length,
    });

    const saved = await this.estimationRepo.save(result);

    await this.projectsService.updateStatus(projectId, ProjectStatus.ESTIMATED);

    this.analyticsService.track(AnalyticsEventName.ESTIMATE_CREATED, userId, {
      project_id: projectId,
      total_items: granularLines.length,
    });

    return saved;
  }

  /**
   * Traduction d'une requête publique en pièce pour le moteur.
   *
   * Partagée par `estimatePublic` et `checkQuotePublic` : les deux surfaces
   * décrivent la **même** pièce, et une seconde copie de ce mapping finirait par
   * ne pas recevoir le champ ajouté à l'autre. C'est déjà arrivé une fois —
   * `exclusions` manquait au chemin public avant GTM-9, si bien que l'écran
   * déduisait une aire que le moteur rachetait derrière.
   */
  private toRoomData(dto: PublicEstimateRequestDto): RoomData {
    return {
      length_cm: dto.length_cm,
      width_cm: dto.width_cm,
      height_cm: dto.height_cm,
      openings: (dto.openings || []).map((o) => ({
        width_cm: o.width_cm,
        height_cm: o.height_cm,
        count: o.count,
        // E1-10 : optionnel côté public — absent, le moteur retient `door`.
        type: o.type,
      })),
      segments: dto.segments?.map((s) => ({
        x_cm: s.x_cm,
        y_cm: s.y_cm,
        length_cm: s.length_cm,
        width_cm: s.width_cm,
      })),
      // GTM-9 : le formulaire public déduit déjà ces aires dans son aperçu en
      // direct. Les omettre ici ferait chiffrer une surface plus grande que
      // celle que la page vient d'afficher — le moteur les filtre ensuite par
      // `surface_target`, une exclusion de sol ne touche pas un mur.
      exclusions: dto.exclusions?.map((e) => ({
        surface_target: e.surface_target,
        area_m2: e.area_m2,
      })),
    };
  }

  /**
   * Cœur de calcul du calculateur public, partagé par `estimatePublic`
   * (calculateur), `checkQuotePublic` (GTM-10) et `emailEstimate` (capture
   * e-mail). Ne track rien : seul `estimatePublic` représente la marche
   * « calcul public effectué » du funnel de revenu (BACKLOG_V1) — le
   * comptabiliser ici conflaterait ces trois surfaces distinctes.
   */
  private async computePublicEstimate(
    dto: PublicEstimateRequestDto,
  ): Promise<PublicEstimateResponse> {
    const workType = await this.workTypesRepo.findOne({
      where: { code: dto.work_type_code },
    });

    if (!workType) {
      throw new NotFoundException('Unknown work type');
    }

    const room = this.toRoomData(dto);

    const skillLevel = dto.skill_level || SkillLevel.INTERMEDIATE;
    // `PUBLIC_WORK_TYPE_CODES` n'expose aucun ouvrage à assiette déclarée : le
    // calculateur public ne peut donc pas atteindre la branche `declared`. Il
    // passe quand même par le même constructeur, pour que le jour où il en
    // exposerait un, le manque soit une erreur et non un chiffrage faux.
    const workItemInput: WorkItemInput = this.toWorkItemInput(workType, {
      id: 'public',
      skillLevel,
      customParams: { ...dto.custom_params },
      materials: await this.loadMaterialInputs(workType),
    });

    const { items, exclusions } = this.engine.computeEstimationDetailed(room, [
      workItemInput,
    ]);

    return {
      work_type_code: workType.code,
      work_type_label: workType.label_fr,
      skill_level: skillLevel,
      total_items: items.length,
      items,
      exclusions,
    };
  }

  async estimatePublic(
    dto: PublicEstimateRequestDto,
  ): Promise<PublicEstimateResponse> {
    const result = await this.computePublicEstimate(dto);

    this.analyticsService.track(
      AnalyticsEventName.PUBLIC_CALCULATION_COMPLETED,
      null,
      {
        work_type_code: result.work_type_code,
        skill_level: result.skill_level,
      },
    );

    return result;
  }

  /**
   * Contrôle de cohérence d'un devis reçu (GTM-10) : la quantité qu'il facture
   * face à celle que la pièce demande.
   *
   * Aucune persistance, aucun compte, et — par décision produit (§ 4.7 de
   * PRODUCT_STRATEGY) — **aucun prix**. La réponse décrit un écart de quantité et
   * la fourchette du catalogue ; elle ne qualifie ni le devis, ni l'entreprise.
   * `checkQuotePublic` réutilise `estimatePublic` plutôt que de refaire son
   * travail : la traduction « ce que la pièce demande » affichée sous le verdict
   * doit être exactement celle du calculateur, sinon les deux surfaces
   * annonceraient deux quantités pour la même pièce.
   */
  async checkQuotePublic(
    dto: PublicQuoteCheckRequestDto,
  ): Promise<PublicQuoteCheckResponse> {
    const estimate = await this.computePublicEstimate(dto);

    const workType = await this.workTypesRepo.findOne({
      where: { code: dto.work_type_code },
    });
    // `estimatePublic` a déjà levé si le code est inconnu ; ce garde-fou n'existe
    // que pour le typage.
    if (!workType) {
      throw new NotFoundException('Unknown work type');
    }

    const room = this.toRoomData(dto);
    const netSurfaceM2 = this.engine.computeSurface(
      room,
      workType.surface_target,
    );
    const grossSurfaceM2 = this.engine.computeGrossSurface(
      room,
      workType.surface_target,
    );

    // E1-7 : même résolution que le moteur, par le même module — la fourchette
    // affichée doit décrire la pose qui a servi à chiffrer, pas une autre.
    const poseType = resolveLayingPose(workType.code, dto.custom_params);
    // La quantité d'un devis suit la surface de l'ouvrage : la fourchette de
    // référence se calcule sur les matériaux surfaciques. Depuis E1-3, les
    // accessoires (rouleaux, croisillons…) peuvent être majoritaires dans un
    // jeu — sans ce filtre, leur fourchette gagnerait le vote de
    // `dominantWasteReference` et un devis honnête serait signalé en écart.
    const reference = dominantWasteReference(
      (await this.loadMaterialInputs(workType)).filter(
        (m) => m.role !== 'accessoire',
      ),
      poseType,
    );

    const impliedPercent = impliedWastePercent(
      dto.declared_surface_m2,
      netSurfaceM2,
    );

    return {
      work_type_code: workType.code,
      work_type_label: workType.label_fr,
      surface_target: workType.surface_target,
      gross_surface_m2: Math.round(grossSurfaceM2 * 100) / 100,
      net_surface_m2: Math.round(netSurfaceM2 * 100) / 100,
      deducted_m2: Math.round((grossSurfaceM2 - netSurfaceM2) * 100) / 100,
      declared_surface_m2: dto.declared_surface_m2,
      implied_waste_percent: impliedPercent,
      reference,
      status: classifyDeclared(impliedPercent, reference),
      items: estimate.items,
      exclusions: estimate.exclusions,
    };
  }

  /**
   * Estimation multi-pièces **sans persistance** (BACKLOG PLAT-5) : ni projet,
   * ni pièce, ni `estimation_results`. C'est ce qui rend l'API publique
   * utilisable par une intégration tierce ou un widget embarqué sans lui ouvrir
   * la moindre surface sur les données métier de l'organisation.
   *
   * Elle vit ici, et non dans le module `api-keys`, pour ne pas dupliquer
   * `loadMaterialInputs` : en recopier le corps forkerait l'invariant
   * `is_eco: false` (PLAT-3) et l'API payante se mettrait, un jour, à chiffrer
   * des matériaux éco que l'application n'utilise pas.
   *
   * Les pièces n'ayant pas d'identifiant persisté, on leur en synthétise un
   * (`room-1`, `room-2`…) : l'agrégation compte ainsi correctement les pièces
   * distinctes et l'appelant peut relier chaque contribution à la pièce qu'il a
   * envoyée.
   */
  async estimatePublicMulti(
    dto: ApiEstimateRequestDto,
  ): Promise<ApiEstimateResponse> {
    const requestedCodes = [
      ...new Set(
        dto.rooms.flatMap((r) => r.work_items.map((w) => w.work_type_code)),
      ),
    ];
    const workTypes = await this.workTypesRepo.find({
      where: { code: In(requestedCodes) },
    });
    const workTypeByCode = new Map(workTypes.map((wt) => [wt.code, wt]));

    const unknown = requestedCodes.filter((c) => !workTypeByCode.has(c));
    if (unknown.length > 0) {
      throw new NotFoundException(
        `Type de travaux inconnu : ${unknown.join(', ')}`,
      );
    }

    // Une requête par ouvrage pour toute la demande, quel que soit le nombre
    // de pièces — même mémoïsation que `estimate()`.
    const materialsByWorkTypeId = new Map<string, MaterialInput[]>();
    const loadMaterials = async (
      workType: WorkType,
    ): Promise<MaterialInput[]> => {
      const cached = materialsByWorkTypeId.get(workType.id);
      if (cached) return cached;
      const loaded = await this.loadMaterialInputs(workType);
      materialsByWorkTypeId.set(workType.id, loaded);
      return loaded;
    };

    const defaultSkillLevel = dto.skill_level ?? SkillLevel.INTERMEDIATE;
    const granularLines: EstimationLineItem[] = [];
    const granularExclusions: MaterialExclusion[] = [];
    const packagingByMaterialId = new Map<string, PackagingInput[]>();

    for (const [index, room] of dto.rooms.entries()) {
      const roomId = `room-${index + 1}`;
      const roomName = room.name ?? `Pièce ${index + 1}`;

      const roomData: RoomData = {
        length_cm: room.length_cm,
        width_cm: room.width_cm,
        height_cm: room.height_cm,
        openings: (room.openings ?? []).map((o) => ({
          width_cm: o.width_cm,
          height_cm: o.height_cm,
          count: o.count,
          // E1-10 : optionnel côté public — absent, le moteur retient `door`.
          type: o.type,
        })),
        segments: room.segments?.map((s) => ({
          x_cm: s.x_cm,
          y_cm: s.y_cm,
          length_cm: s.length_cm,
          width_cm: s.width_cm,
        })),
      };

      const workItemInputs: WorkItemInput[] = [];
      for (const item of room.work_items) {
        const workType = workTypeByCode.get(item.work_type_code)!;
        const materialInputs = await loadMaterials(workType);

        for (const mat of materialInputs) {
          if (!packagingByMaterialId.has(mat.id)) {
            packagingByMaterialId.set(mat.id, mat.packagings);
          }
        }

        workItemInputs.push(
          this.toWorkItemInput(workType, {
            id: `${roomId}:${workType.code}`,
            skillLevel: item.skill_level ?? defaultSkillLevel,
            customParams: { ...item.custom_params },
            materials: materialInputs,
            declaredLengthM: item.declared_length_m,
            declaredHeightM: item.declared_height_m,
            declaredCladFaces: item.declared_clad_faces,
          }),
        );
      }

      const { items, exclusions } = this.engine.computeEstimationDetailed(
        roomData,
        workItemInputs,
      );
      for (const line of items) {
        granularLines.push({ ...line, room_id: roomId, room_name: roomName });
      }
      for (const exclusion of exclusions) {
        granularExclusions.push({
          ...exclusion,
          room_id: roomId,
          room_name: roomName,
        });
      }
    }

    return {
      rooms_count: dto.rooms.length,
      total_items: granularLines.length,
      items: granularLines,
      aggregated: this.engine.aggregatePurchases(
        granularLines,
        packagingByMaterialId,
      ),
      exclusions: granularExclusions,
    };
  }

  /** Types de travaux exposés par l'API publique — données de référence. */
  async listWorkTypes(): Promise<WorkType[]> {
    return this.workTypesRepo.find({ order: { display_order: 'ASC' } });
  }

  async emailEstimate(
    dto: PublicEstimateEmailDto,
  ): Promise<PublicEstimateEmailResponse> {
    if (!dto.consent) {
      throw new BadRequestException(
        'Le consentement est requis pour recevoir cette estimation par e-mail.',
      );
    }

    // Ne jamais faire confiance à un résultat fourni par le client : on
    // recalcule toujours côté serveur avant de l'inclure dans l'e-mail.
    const result = await this.computePublicEstimate(dto);

    const entry = this.emailCaptureRepo.create({
      email: dto.email,
      work_type_code: result.work_type_code,
      skill_level: result.skill_level,
      estimate_snapshot: result.items,
      consent: true,
      consent_at: new Date(),
    });
    const saved = await this.emailCaptureRepo.save(entry);

    let sent = false;
    try {
      await this.emailService.sendCalculatorResultEmail(dto.email, {
        workTypeLabel: result.work_type_label,
        items: result.items,
      });
      saved.email_sent_at = new Date();
      await this.emailCaptureRepo.save(saved);
      sent = true;
    } catch (err) {
      // Ne jamais logger l'adresse elle-même, seulement l'id de la capture.
      this.logger.warn(
        `Échec de l'envoi Brevo pour la capture ${saved.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    this.analyticsService.track(AnalyticsEventName.EMAIL_CAPTURE, null, {
      work_type_code: result.work_type_code,
      skill_level: result.skill_level,
      sent,
    });

    return { sent };
  }

  async getLatest(
    projectId: string,
    organizationId: string,
  ): Promise<EstimationResult> {
    await this.projectsService.findOneForOrg(projectId, organizationId);

    const result = await this.estimationRepo.findOne({
      where: { project_id: projectId },
      order: { created_at: 'DESC' },
    });

    if (!result) {
      throw new NotFoundException('No estimation found for this project');
    }

    return result;
  }

  async findById(estimationId: string): Promise<EstimationResult> {
    const result = await this.estimationRepo.findOne({
      where: { id: estimationId },
    });

    if (!result) {
      throw new NotFoundException('Estimation not found');
    }

    return result;
  }

  async getHistory(
    projectId: string,
    organizationId: string,
  ): Promise<EstimationResult[]> {
    await this.projectsService.findOneForOrg(projectId, organizationId);

    return this.estimationRepo.find({
      where: { project_id: projectId },
      order: { created_at: 'DESC' },
    });
  }
}
