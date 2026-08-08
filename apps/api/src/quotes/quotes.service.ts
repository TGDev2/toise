import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  Quote,
  QuoteStatus,
  QuoteLineItem,
  QuoteLaborLine,
  ProposedQuoteLaborLine,
} from './entities/quote.entity';
import {
  EstimationResult,
  EstimationLineItem,
} from '../estimations/entities/estimation-result.entity';
import { ShoppingListsService } from '../shopping-lists/shopping-lists.service';
import { ProjectsService } from '../projects/projects.service';
import { resolveLaborTime } from '../projects/labor-time-resolution';
import { ClientsService } from '../clients/clients.service';
import { CompanyProfilesService } from '../company-profiles/company-profiles.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { QuoteLaborLineDto } from './dto/quote-labor-line.dto';
import { round2 } from '../common/round2';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
import { QuantityValidationsService } from '../quantity-validation/quantity-validations.service';
import { selectQuotableItems } from '../quantity-validation/quantity-fingerprint';

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(Quote)
    private readonly repo: Repository<Quote>,
    @InjectRepository(EstimationResult)
    private readonly estimationRepo: Repository<EstimationResult>,
    private readonly dataSource: DataSource,
    private readonly shoppingListsService: ShoppingListsService,
    private readonly projectsService: ProjectsService,
    private readonly clientsService: ClientsService,
    private readonly companyProfilesService: CompanyProfilesService,
    private readonly analyticsService: AnalyticsService,
    private readonly quantityValidations: QuantityValidationsService,
  ) {}

  async create(
    organizationId: string,
    userId: string,
    dto: CreateQuoteDto,
  ): Promise<Quote> {
    // Verify project belongs to the organization
    await this.projectsService.findOneForOrg(dto.project_id, organizationId);

    // Verify estimation exists and belongs to project
    const estimation = await this.estimationRepo.findOne({
      where: { id: dto.estimation_id, project_id: dto.project_id },
    });
    if (!estimation) {
      throw new NotFoundException('Estimation non trouvee pour ce projet');
    }

    // Verify client belongs to the organization when provided
    if (dto.client_id) {
      await this.clientsService.findOneForOrg(dto.client_id, organizationId);
    }

    // Get shopping list for prices
    const { shoppingList } = await this.shoppingListsService.getOrGenerate(
      dto.project_id,
      organizationId,
      userId,
    );

    // E2-4 — troisième ligne de défense. La garde porte sur les quantités que
    // ce devis va figer, pas sur un identifiant de validation fourni par
    // l'appelant : c'est la seule forme qui résiste à une correction faite
    // entre la validation et l'émission, depuis n'importe quel écran.
    await this.quantityValidations.assertValidated(
      dto.project_id,
      shoppingList.items_json.material_items,
    );

    // Build items snapshot with margin
    const marginPercent = dto.material_margin_percent;
    const items: QuoteLineItem[] = selectQuotableItems(
      shoppingList.items_json.material_items,
    ).map((item) => {
      const basePrice = Number(item.real_unit_price);
      const priceWithMargin = basePrice * (1 + marginPercent / 100);
      const lineTotal = priceWithMargin * item.units_needed;
      return {
        material_name: item.material_name,
        material_category: item.material_category,
        work_type_label: item.work_type_label,
        packaging_label: item.packaging_label,
        units_needed: item.units_needed,
        base_unit_price: Math.round(basePrice * 100) / 100,
        margin_percent: marginPercent,
        unit_price_with_margin: Math.round(priceWithMargin * 100) / 100,
        line_total_ht: Math.round(lineTotal * 100) / 100,
        // E1-11 : figée à l'émission, marque comprise — le devis est un
        // document, le choix marque/sans-marque se fait à l'affichage.
        justification: item.justification,
      };
    });

    // Calculate totals
    const subtotalMaterials = items.reduce(
      (sum, i) => sum + i.line_total_ht,
      0,
    );
    const laborLines = dto.labor_items
      ? this.normaliseLaborLines(dto.labor_items)
      : [];
    const subtotalLabor = this.sumLaborLines(laborLines);
    const discountPercent = dto.discount_percent ?? 0;
    const totalHt =
      (subtotalMaterials + subtotalLabor) * (1 - discountPercent / 100);
    const tvaRate = dto.tva_rate ?? 20;
    const totalTtc = totalHt * (1 + tvaRate / 100);

    // Numéro alloué et devis inséré dans la même transaction : un échec rend le
    // numéro au lieu de le consommer.
    const quote = await this.dataSource.transaction(async (manager) => {
      const quoteNumber = await this.allocateQuoteNumber(
        manager,
        organizationId,
        new Date().getFullYear(),
      );

      const created = manager.create(Quote, {
        organization_id: organizationId,
        user_id: userId,
        project_id: dto.project_id,
        client_id: dto.client_id ?? null,
        estimation_id: dto.estimation_id,
        quote_number: quoteNumber,
        status: QuoteStatus.DRAFT,
        labor_items_json: laborLines,
        material_margin_percent: marginPercent,
        discount_percent: discountPercent,
        payment_terms: dto.payment_terms ?? null,
        validity_days: dto.validity_days ?? 30,
        notes: dto.notes ?? null,
        show_material_details: dto.show_material_details ?? false,
        show_material_justifications: dto.show_material_justifications ?? false,
        items_json: items,
        subtotal_materials_ht: Math.round(subtotalMaterials * 100) / 100,
        subtotal_labor_ht: Math.round(subtotalLabor * 100) / 100,
        total_ht: Math.round(totalHt * 100) / 100,
        tva_rate: tvaRate,
        total_ttc: Math.round(totalTtc * 100) / 100,
      });

      return manager.save(created);
    });

    this.analyticsService.track(AnalyticsEventName.QUOTE_GENERATED, userId, {
      project_id: dto.project_id,
      quote_id: quote.id,
    });

    return quote;
  }

  async findAllForOrg(
    organizationId: string,
    status?: QuoteStatus,
  ): Promise<Quote[]> {
    const where: Record<string, unknown> = { organization_id: organizationId };
    if (status) {
      where.status = status;
    }
    return this.repo.find({
      where,
      relations: ['project', 'client'],
      order: { created_at: 'DESC' },
    });
  }

  async findOneForOrg(id: string, organizationId: string): Promise<Quote> {
    const quote = await this.repo.findOne({
      where: { id, organization_id: organizationId },
      relations: ['project', 'client'],
    });
    if (!quote) {
      throw new NotFoundException('Devis non trouve');
    }
    return quote;
  }

  /**
   * E2-5 — noms des pièces réellement couvertes par ce devis, pour son
   * récapitulatif. `items_json` (matériaux) ne porte aucune pièce ;
   * `labor_items_json` en porte une mais peut être vide (devis sans
   * main-d'œuvre). La source fiable est l'estimation d'origine — figée,
   * toujours présente (`onDelete: 'CASCADE'` sur `Quote.estimation`) — dont
   * chaque ligne porte `room_name` depuis `EstimationsService.estimate`.
   */
  async getCoveredRoomNames(estimationId: string): Promise<string[]> {
    const estimation = await this.estimationRepo.findOne({
      where: { id: estimationId },
      select: ['items_json'],
    });
    if (!estimation) return [];
    const names = estimation.items_json
      .map((item) => item.room_name)
      .filter((name): name is string => Boolean(name));
    return Array.from(new Set(names));
  }

  async countForOrg(organizationId: string): Promise<number> {
    return this.repo.count({ where: { organization_id: organizationId } });
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateQuoteDto,
  ): Promise<Quote> {
    const quote = await this.findOneForOrg(id, organizationId);

    if (quote.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException(
        'Seul un devis en brouillon peut etre modifie',
      );
    }

    // Apply updates
    if (dto.client_id !== undefined) {
      if (dto.client_id !== null) {
        await this.clientsService.findOneForOrg(dto.client_id, organizationId);
      }
      quote.client_id = dto.client_id;
    }
    // `labor_items` absent : le tableau existant n'est pas touché (même
    // contrat que `items_json`, remanié seulement si `material_margin_percent`
    // est fourni) — sans cette règle, changer la TVA effacerait une saisie
    // manuelle d'heures. Fourni, même `[]`, il remplace tout le tableau.
    if (dto.labor_items !== undefined) {
      quote.labor_items_json = this.normaliseLaborLines(dto.labor_items);
    }
    if (dto.payment_terms !== undefined)
      quote.payment_terms = dto.payment_terms;
    if (dto.validity_days !== undefined)
      quote.validity_days = dto.validity_days;
    if (dto.notes !== undefined) quote.notes = dto.notes;
    if (dto.tva_rate !== undefined) quote.tva_rate = dto.tva_rate;
    if (dto.discount_percent !== undefined)
      quote.discount_percent = dto.discount_percent;
    if (dto.show_material_details !== undefined)
      quote.show_material_details = dto.show_material_details;
    if (dto.show_material_justifications !== undefined)
      quote.show_material_justifications = dto.show_material_justifications;

    // Recalculate if margin changed
    if (dto.material_margin_percent !== undefined) {
      quote.material_margin_percent = dto.material_margin_percent;
      // Re-snapshot items with new margin
      quote.items_json = quote.items_json.map((item) => {
        const priceWithMargin =
          item.base_unit_price * (1 + dto.material_margin_percent! / 100);
        return {
          ...item,
          margin_percent: dto.material_margin_percent!,
          unit_price_with_margin: Math.round(priceWithMargin * 100) / 100,
          line_total_ht:
            Math.round(priceWithMargin * item.units_needed * 100) / 100,
        };
      });
    }

    // Recalculate totals
    const subtotalMaterials = quote.items_json.reduce(
      (sum, i) => sum + i.line_total_ht,
      0,
    );
    const subtotalLabor = this.sumLaborLines(quote.labor_items_json);
    const discountPercent = Number(quote.discount_percent) || 0;
    const totalHt =
      (subtotalMaterials + subtotalLabor) * (1 - discountPercent / 100);
    const totalTtc = totalHt * (1 + Number(quote.tva_rate) / 100);

    quote.subtotal_materials_ht = Math.round(subtotalMaterials * 100) / 100;
    quote.subtotal_labor_ht = Math.round(subtotalLabor * 100) / 100;
    quote.total_ht = Math.round(totalHt * 100) / 100;
    quote.total_ttc = Math.round(totalTtc * 100) / 100;

    return this.repo.save(quote);
  }

  async updateStatus(
    id: string,
    organizationId: string,
    status: QuoteStatus,
  ): Promise<Quote> {
    const quote = await this.findOneForOrg(id, organizationId);

    quote.status = status;
    const now = new Date();

    if (status === QuoteStatus.SENT && !quote.sent_at) {
      quote.sent_at = now;
    }
    if (status === QuoteStatus.ACCEPTED) {
      quote.accepted_at = now;
    }
    if (status === QuoteStatus.REFUSED) {
      quote.refused_at = now;
    }

    return this.repo.save(quote);
  }

  async remove(id: string, organizationId: string): Promise<void> {
    const quote = await this.findOneForOrg(id, organizationId);
    if (quote.status !== QuoteStatus.DRAFT) {
      throw new BadRequestException(
        'Seul un devis en brouillon peut etre supprime',
      );
    }
    await this.repo.remove(quote);
  }

  /**
   * Propose les lignes de MO d'un devis à partir des ouvrages de son estimation.
   * Lecture pure, aucune écriture : `POST /quotes` n'utilise jamais cette
   * méthode implicitement, il n'accepte que ce que le client envoie
   * explicitement (leçon 18 — le serveur propose, il n'invente pas sur
   * l'écriture). Exposée par `GET /quotes/labor-proposal`.
   */
  async proposeLaborLines(
    organizationId: string,
    projectId: string,
    estimationId: string,
  ): Promise<ProposedQuoteLaborLine[]> {
    await this.projectsService.findOneForOrg(projectId, organizationId);
    const estimation = await this.estimationRepo.findOne({
      where: { id: estimationId, project_id: projectId },
    });
    if (!estimation) {
      throw new NotFoundException('Estimation non trouvee pour ce projet');
    }
    return this.buildProposedLaborLines(organizationId, estimation);
  }

  /**
   * E2-2 — les heures viennent du registre sourcé d'E2-1 (`labor_times`), plus
   * de `work_types.labor_minutes_per_m2` : sept constantes que la migration qui
   * les a posées qualifiait elle-même d'ordres de grandeur métier, sans une
   * source à opposer à un client qui conteste un devis.
   *
   * Les deux axes du registre sont lus **sur la ligne**, jamais sur
   * l'estimation : `pose_type` y est depuis E1-7, `skill_level` depuis ce lot.
   * `estimation.skill_level` ne sert que de repli pour les estimations
   * antérieures — c'est le niveau du premier ouvrage, pas celui de chacun.
   */
  private async buildProposedLaborLines(
    organizationId: string,
    estimation: EstimationResult,
  ): Promise<ProposedQuoteLaborLine[]> {
    const profile =
      await this.companyProfilesService.findByOrganizationId(organizationId);
    const rate = Number(profile?.default_labor_hourly_rate) || 0;

    const laborTimes = await this.projectsService.getLaborTimes();

    return this.dedupeByWorkItem(estimation.items_json)
      .filter((item) => item.surface_m2 !== 0)
      .map((item) => {
        const time = resolveLaborTime(
          laborTimes,
          item.work_type_code,
          item.pose_type,
          item.skill_level ?? estimation.skill_level,
        );

        // Le temps se multiplie par l'assiette **de son unité**. Toutes les
        // lignes seedées sont en m², et l'assiette dont dispose le devis est
        // une surface : un temps au mètre linéaire ou à la pièce, ajouté plus
        // tard au registre, ne doit pas être multiplié par des m² en silence.
        // Sans temps applicable, aucune heure proposée — pas de valeur de
        // repli, c'est le trou de données qu'il faut voir.
        const applicable = time !== null && time.unit_basis === 'm2';
        const quantity = applicable
          ? round2(item.surface_m2 * time.hours_per_unit)
          : 0;

        return {
          work_item_id: item.work_item_id ?? null,
          work_type_code: item.work_type_code,
          label: item.work_type_label,
          room_name: item.room_name ?? null,
          kind: 'hourly' as const,
          surface_m2: item.surface_m2,
          quantity,
          unit_price_ht: rate,
          line_total_ht: round2(quantity * rate),
          ...(applicable
            ? {
                basis: {
                  hours_per_unit: time.hours_per_unit,
                  unit_basis: time.unit_basis,
                  skill_level: time.skill_level,
                  source_org: time.source_org,
                  source_document: time.source_document,
                  source_url: time.source_url,
                },
              }
            : {}),
        };
      });
  }

  /**
   * Dédoublonne par ouvrage, jamais par somme : plusieurs matériaux d'un même
   * work item répètent le même `surface_m2` (calculé une fois par ouvrage dans
   * le moteur d'estimation), en garder plusieurs sommerait une surface qui n'a
   * jamais existé. Clé de repli `room_id:work_type_code` pour les estimations
   * antérieures à ENG-2 ou sans `work_item_id`.
   */
  private dedupeByWorkItem(items: EstimationLineItem[]): EstimationLineItem[] {
    const seen = new Set<string>();
    const result: EstimationLineItem[] = [];
    for (const item of items) {
      const key =
        item.work_item_id ?? `${item.room_id ?? ''}:${item.work_type_code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
    return result;
  }

  /**
   * Normalise les lignes envoyées par le client : `line_total_ht` n'est
   * jamais accepté tel quel (falsification de prix triviale sinon), et
   * `quantity` vaut toujours 1 sur un forfait.
   */
  private normaliseLaborLines(lines: QuoteLaborLineDto[]): QuoteLaborLine[] {
    return lines.map((line) => {
      const quantity = line.kind === 'flat' ? 1 : Number(line.quantity) || 0;
      const unitPriceHt = Number(line.unit_price_ht) || 0;
      return {
        work_item_id: line.work_item_id ?? null,
        work_type_code: line.work_type_code ?? null,
        label: line.label,
        room_name: line.room_name ?? null,
        kind: line.kind,
        surface_m2: line.surface_m2 ?? null,
        quantity,
        unit_price_ht: unitPriceHt,
        line_total_ht: round2(quantity * unitPriceHt),
      };
    });
  }

  private sumLaborLines(lines: QuoteLaborLine[]): number {
    return round2(lines.reduce((sum, line) => sum + line.line_total_ht, 0));
  }

  /**
   * Alloue le prochain numéro de devis de l'organisation, dans la transaction
   * qui insère le devis.
   *
   * Le `MAX(quote_number) … LIKE` d'origine convenait tant qu'un compte était
   * mono-utilisateur : deux devis ne pouvaient pas naître en parallèle. Avec des
   * membres (PLAT-4) c'est faux, et sans verrou deux allocations simultanées
   * rendaient le même numéro — que `UQ_quotes_org_number` transformerait en 500.
   * On reprend donc le compteur `ON CONFLICT … DO UPDATE … RETURNING` de PRO-4,
   * qui sérialise les allocations sur un verrou de ligne. Les trous, interdits
   * sur une facture, sont ici sans enjeu : c'est le verrou qu'on vient chercher.
   */
  private async allocateQuoteNumber(
    manager: EntityManager,
    organizationId: string,
    year: number,
  ): Promise<string> {
    const rows = await manager.query<{ last_number: number }[]>(
      `INSERT INTO "quote_sequences" ("organization_id", "year", "last_number")
       VALUES ($1, $2, 1)
       ON CONFLICT ("organization_id", "year")
       DO UPDATE SET "last_number" = "quote_sequences"."last_number" + 1
       RETURNING "last_number"`,
      [organizationId, year],
    );
    return `D-${year}-${String(Number(rows[0].last_number)).padStart(3, '0')}`;
  }
}
