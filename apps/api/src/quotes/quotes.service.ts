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
  LaborType,
} from './entities/quote.entity';
import { EstimationResult } from '../estimations/entities/estimation-result.entity';
import { ShoppingListsService } from '../shopping-lists/shopping-lists.service';
import { ProjectsService } from '../projects/projects.service';
import { ClientsService } from '../clients/clients.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';

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

    // Build items snapshot with margin
    const marginPercent = dto.material_margin_percent;
    const items: QuoteLineItem[] = shoppingList.items_json.material_items
      .filter(
        (item) => item.real_unit_price != null && item.real_unit_price > 0,
      )
      .map((item) => {
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
        };
      });

    // Calculate totals
    const subtotalMaterials = items.reduce(
      (sum, i) => sum + i.line_total_ht,
      0,
    );
    const subtotalLabor = this.computeLaborTotal(dto);
    const discountPercent = dto.discount_percent ?? 0;
    const totalHt =
      (subtotalMaterials + subtotalLabor) * (1 - discountPercent / 100);
    const tvaRate = dto.tva_rate ?? 20;
    const totalTtc = totalHt * (1 + tvaRate / 100);

    // Numéro alloué et devis inséré dans la même transaction : un échec rend le
    // numéro au lieu de le consommer.
    return this.dataSource.transaction(async (manager) => {
      const quoteNumber = await this.allocateQuoteNumber(
        manager,
        organizationId,
        new Date().getFullYear(),
      );

      const quote = manager.create(Quote, {
        organization_id: organizationId,
        user_id: userId,
        project_id: dto.project_id,
        client_id: dto.client_id ?? null,
        estimation_id: dto.estimation_id,
        quote_number: quoteNumber,
        status: QuoteStatus.DRAFT,
        labor_type: dto.labor_type,
        labor_hourly_rate: dto.labor_hourly_rate ?? null,
        labor_estimated_hours: dto.labor_estimated_hours ?? null,
        labor_flat_amount: dto.labor_flat_amount ?? null,
        material_margin_percent: marginPercent,
        discount_percent: discountPercent,
        payment_terms: dto.payment_terms ?? null,
        validity_days: dto.validity_days ?? 30,
        notes: dto.notes ?? null,
        items_json: items,
        subtotal_materials_ht: Math.round(subtotalMaterials * 100) / 100,
        subtotal_labor_ht: Math.round(subtotalLabor * 100) / 100,
        total_ht: Math.round(totalHt * 100) / 100,
        tva_rate: tvaRate,
        total_ttc: Math.round(totalTtc * 100) / 100,
      });

      return manager.save(quote);
    });
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
    if (dto.labor_type !== undefined) quote.labor_type = dto.labor_type;
    if (dto.labor_hourly_rate !== undefined)
      quote.labor_hourly_rate = dto.labor_hourly_rate;
    if (dto.labor_estimated_hours !== undefined)
      quote.labor_estimated_hours = dto.labor_estimated_hours;
    if (dto.labor_flat_amount !== undefined)
      quote.labor_flat_amount = dto.labor_flat_amount;
    if (dto.payment_terms !== undefined)
      quote.payment_terms = dto.payment_terms;
    if (dto.validity_days !== undefined)
      quote.validity_days = dto.validity_days;
    if (dto.notes !== undefined) quote.notes = dto.notes;
    if (dto.tva_rate !== undefined) quote.tva_rate = dto.tva_rate;
    if (dto.discount_percent !== undefined)
      quote.discount_percent = dto.discount_percent;

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
    const subtotalLabor = this.computeLaborTotalFromQuote(quote);
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

  private computeLaborTotal(dto: CreateQuoteDto): number {
    if (dto.labor_type === LaborType.FLAT) {
      return dto.labor_flat_amount ?? 0;
    }
    return (dto.labor_hourly_rate ?? 0) * (dto.labor_estimated_hours ?? 0);
  }

  private computeLaborTotalFromQuote(quote: Quote): number {
    if (quote.labor_type === LaborType.FLAT) {
      return Number(quote.labor_flat_amount) || 0;
    }
    return (
      (Number(quote.labor_hourly_rate) || 0) *
      (Number(quote.labor_estimated_hours) || 0)
    );
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
