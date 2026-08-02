import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { OrganizationRole } from '../organizations/entities/organization-membership.entity';
import type { OrgScope } from '../organizations/org-context.service';
import { EstimationsService } from '../estimations/estimations.service';
import type { ApiEstimateRequestDto } from '../estimations/dto/api-estimate-request.dto';
import type { WorkType } from '../projects/entities/work-type.entity';
import { WidgetConfig } from './entities/widget-config.entity';
import { UpdateWidgetConfigDto } from './dto/update-widget-config.dto';

export const WIDGET_KEY_PREFIX = 'wgt_';

export interface WidgetConfigView {
  widget_key: string;
  allowed_origins: string[];
  enabled: boolean;
  display_name: string | null;
  accent_color: string | null;
}

export interface WidgetPublicConfig {
  display_name: string | null;
  accent_color: string | null;
  powered_by: 'Chiffréo';
}

/** Rafraîchie paresseusement, même idiome que `FeatureGatesService.ensureCache()`. */
const ORIGIN_CACHE_TTL_MS = 60_000;

/**
 * Widget marque blanche (BACKLOG PLAT-7).
 *
 * `isOriginAllowedForCors` maintient un cache en mémoire des origines de toute
 * configuration active : c'est une vérification **grossière**, utilisée
 * uniquement par la couche CORS globale (`main.ts`) pour décider si le
 * navigateur restitue la réponse au JS appelant. Elle ne remplace pas la
 * vérification **précise** par `widget_key` faite par `WidgetOriginGuard` —
 * sans ce cache, n'importe quel en-tête `Origin` forgé forcerait une requête
 * Postgres à chaque préflight, y compris depuis un appelant anonyme.
 */
@Injectable()
export class WidgetService {
  private readonly logger = new Logger(WidgetService.name);
  private originCache: Set<string> | null = null;
  private originCacheExpiry = 0;

  constructor(
    @InjectRepository(WidgetConfig)
    private readonly widgetConfigsRepo: Repository<WidgetConfig>,
    private readonly estimationsService: EstimationsService,
  ) {}

  async getOrCreate(scope: OrgScope): Promise<WidgetConfigView> {
    this.assertCanManageWidget(scope);
    const config = await this.getOrCreateEntity(scope);
    return this.toView(config);
  }

  async update(
    scope: OrgScope,
    dto: UpdateWidgetConfigDto,
  ): Promise<WidgetConfigView> {
    this.assertCanManageWidget(scope);
    const config = await this.getOrCreateEntity(scope);

    if (dto.allowed_origins !== undefined)
      config.allowed_origins = dto.allowed_origins;
    if (dto.display_name !== undefined) config.display_name = dto.display_name;
    if (dto.accent_color !== undefined) config.accent_color = dto.accent_color;
    if (dto.enabled !== undefined) config.enabled = dto.enabled;

    const saved = await this.widgetConfigsRepo.save(config);
    this.invalidateOriginCache();
    return this.toView(saved);
  }

  /**
   * Régénération **immédiate**, sans fenêtre de grâce contrairement à la
   * rotation des clés d'API (PLAT-5) : la clé n'étant pas secrète, le risque
   * n'est pas une fuite mais une intégration déjà déployée qui casse aussitôt.
   * Accepté pour la v1 — cf. tasks/todo.md §PLAT-7 D3.
   */
  async regenerateKey(scope: OrgScope): Promise<WidgetConfigView> {
    this.assertCanManageWidget(scope);
    const config = await this.getOrCreateEntity(scope);

    config.widget_key = this.generateWidgetKey();
    const saved = await this.widgetConfigsRepo.save(config);
    this.invalidateOriginCache();
    return this.toView(saved);
  }

  /** Recherche par clé, pour le guard. Renvoie la ligne telle quelle — désactivée comprise. */
  findActiveByKey(widgetKey: string): Promise<WidgetConfig | null> {
    return this.widgetConfigsRepo.findOne({ where: { widget_key: widgetKey } });
  }

  async isOriginAllowedForCors(origin: string): Promise<boolean> {
    await this.ensureOriginCache();
    return this.originCache!.has(origin);
  }

  async estimate(dto: ApiEstimateRequestDto) {
    return this.estimationsService.estimatePublicMulti(dto);
  }

  async listWorkTypes(): Promise<WorkType[]> {
    return this.estimationsService.listWorkTypes();
  }

  publicConfig(config: WidgetConfig): WidgetPublicConfig {
    return {
      display_name: config.display_name,
      accent_color: config.accent_color,
      powered_by: 'Chiffréo',
    };
  }

  // ---------------------------------------------------------------------------

  private generateWidgetKey(): string {
    return `${WIDGET_KEY_PREFIX}${randomBytes(16).toString('hex')}`;
  }

  private toView(config: WidgetConfig): WidgetConfigView {
    return {
      widget_key: config.widget_key,
      allowed_origins: config.allowed_origins,
      enabled: config.enabled,
      display_name: config.display_name,
      accent_color: config.accent_color,
    };
  }

  private async getOrCreateEntity(scope: OrgScope): Promise<WidgetConfig> {
    const existing = await this.widgetConfigsRepo.findOne({
      where: { organization_id: scope.organizationId },
    });
    if (existing) return existing;

    try {
      return await this.widgetConfigsRepo.save(
        this.widgetConfigsRepo.create({
          organization_id: scope.organizationId,
          widget_key: this.generateWidgetKey(),
          allowed_origins: [],
          enabled: true,
        }),
      );
    } catch (error) {
      // Deux onglets d'administration ouvrant la page en même temps sur une
      // organisation neuve : l'index unique sur `organization_id` en rejette
      // un, qui relit la ligne gagnante — même patron que
      // `OrgContextService.getOrCreatePersonalOrganization`.
      if (!(error instanceof QueryFailedError)) throw error;
      const created = await this.widgetConfigsRepo.findOne({
        where: { organization_id: scope.organizationId },
      });
      if (!created) throw error;
      return created;
    }
  }

  private invalidateOriginCache(): void {
    this.originCache = null;
    this.originCacheExpiry = 0;
  }

  private async ensureOriginCache(): Promise<void> {
    if (this.originCache && Date.now() < this.originCacheExpiry) return;

    const configs = await this.widgetConfigsRepo.find({
      where: { enabled: true },
      select: ['allowed_origins'],
    });
    this.originCache = new Set(configs.flatMap((c) => c.allowed_origins));
    this.originCacheExpiry = Date.now() + ORIGIN_CACHE_TTL_MS;
  }

  /**
   * Même exigence que les clés d'API (PLAT-5) : configurer le widget, c'est
   * choisir quelles origines peuvent consommer le quota et porter le nom de
   * l'organisation — réservé au propriétaire et aux administrateurs.
   */
  private assertCanManageWidget(scope: OrgScope): void {
    if (
      scope.role !== OrganizationRole.OWNER &&
      scope.role !== OrganizationRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Seuls le propriétaire et les administrateurs gèrent le widget',
      );
    }
  }
}
