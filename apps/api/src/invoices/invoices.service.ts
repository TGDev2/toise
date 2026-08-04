import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  Invoice,
  InvoiceStatus,
  InvoiceType,
  OperationCategory,
  type InvoiceLineItem,
  type InvoicePartySnapshot,
  type VatBreakdownEntry,
} from './entities/invoice.entity';
import { QuoteStatus, type Quote } from '../quotes/entities/quote.entity';
import { QuotesService } from '../quotes/quotes.service';
import { CompanyProfilesService } from '../company-profiles/company-profiles.service';
import { ClientsService } from '../clients/clients.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto';
import { findMissingLegalMentions } from './invoice-legal-mentions';
import type { CompanyProfile } from '../company-profiles/entities/company-profile.entity';
import type { Client } from '../clients/entities/client.entity';
import { round2 } from '../common/round2';

const VAT_EXEMPTION_REASON = 'TVA non applicable, art. 293 B du CGI';
const DEFAULT_PAYMENT_TERMS_DAYS = 30;

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly repo: Repository<Invoice>,
    private readonly dataSource: DataSource,
    private readonly quotesService: QuotesService,
    private readonly companyProfilesService: CompanyProfilesService,
    private readonly clientsService: ClientsService,
  ) {}

  async createFromQuote(
    organizationId: string,
    userId: string,
    dto: CreateInvoiceDto,
  ): Promise<Invoice> {
    const quote = await this.quotesService.findOneForOrg(
      dto.quote_id,
      organizationId,
    );

    if (quote.status !== QuoteStatus.ACCEPTED) {
      throw new BadRequestException(
        'Seul un devis accepte peut etre transforme en facture',
      );
    }

    const existing = await this.repo.findOne({
      where: { quote_id: quote.id, invoice_type: InvoiceType.SOLDE },
    });
    if (existing) {
      throw new ConflictException({
        message: 'Une facture existe deja pour ce devis',
        error: 'INVOICE_ALREADY_EXISTS',
        invoice_id: existing.id,
        invoice_number: existing.invoice_number,
      });
    }

    const profile =
      await this.companyProfilesService.findByOrganizationId(organizationId);
    if (!profile) {
      throw new BadRequestException({
        message: 'Profil entreprise requis pour emettre une facture',
        error: 'MISSING_LEGAL_MENTIONS',
        missing_fields: ['company_profile'],
      });
    }

    const missing = findMissingLegalMentions(profile);
    if (missing.length > 0) {
      throw new BadRequestException({
        message:
          'Mentions legales manquantes sur le profil entreprise, facture non emise',
        error: 'MISSING_LEGAL_MENTIONS',
        missing_fields: missing,
      });
    }

    const client = quote.client_id
      ? await this.clientsService.findOneForOrg(quote.client_id, organizationId)
      : null;

    const issuedOn = dto.issued_on ?? this.todayInParis();
    const dueOn =
      dto.due_on ??
      this.addDays(
        issuedOn,
        profile.default_payment_terms_days ?? DEFAULT_PAYMENT_TERMS_DAYS,
      );

    const vatRate = profile.vat_exempt ? 0 : Number(quote.tva_rate) || 0;
    const items = this.buildLineItems(quote, vatRate);
    const totalHt = round2(items.reduce((sum, i) => sum + i.line_total_ht, 0));
    const totalTva = round2((totalHt * vatRate) / 100);

    // Le numéro est alloué et la facture insérée dans la même transaction : un
    // échec rend le numéro au lieu de laisser un trou dans la séquence.
    return this.dataSource.transaction(async (manager) => {
      const year = Number(issuedOn.slice(0, 4));
      const sequence = await this.allocateNumber(manager, organizationId, year);

      const invoice = manager.create(Invoice, {
        organization_id: organizationId,
        user_id: userId,
        quote_id: quote.id,
        project_id: quote.project_id,
        client_id: quote.client_id,
        invoice_number: `F-${year}-${String(sequence).padStart(4, '0')}`,
        invoice_type: InvoiceType.SOLDE,
        status: InvoiceStatus.ISSUED,
        source_quote_number: quote.quote_number,
        issued_on: issuedOn,
        supply_date: dto.supply_date ?? issuedOn,
        due_on: dueOn,
        currency: 'EUR',
        seller_snapshot: this.buildSellerSnapshot(profile),
        buyer_snapshot: this.buildBuyerSnapshot(client),
        buyer_siren:
          client?.is_company && client.siret ? client.siret.slice(0, 9) : null,
        delivery_address: dto.delivery_address ?? null,
        operation_category: dto.operation_category ?? OperationCategory.MIXTE,
        vat_on_debits: dto.vat_on_debits ?? false,
        items_json: items,
        vat_breakdown: this.buildVatBreakdown(
          totalHt,
          totalTva,
          vatRate,
          profile.vat_exempt,
        ),
        total_ht: totalHt,
        total_tva: totalTva,
        total_ttc: round2(totalHt + totalTva),
        payment_terms: dto.payment_terms ?? quote.payment_terms,
        late_penalty_rate: profile.late_penalty_rate ?? null,
        notes: dto.notes ?? null,
      });

      return manager.save(invoice);
    });
  }

  async findAllForOrg(
    organizationId: string,
    filters: { status?: InvoiceStatus; quote_id?: string } = {},
  ): Promise<Invoice[]> {
    const where: Record<string, unknown> = { organization_id: organizationId };
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.quote_id) {
      where.quote_id = filters.quote_id;
    }
    return this.repo.find({
      where,
      relations: ['project', 'client'],
      order: { issued_on: 'DESC', created_at: 'DESC' },
    });
  }

  async findOneForOrg(id: string, organizationId: string): Promise<Invoice> {
    const invoice = await this.repo.findOne({
      where: { id, organization_id: organizationId },
      relations: ['project', 'client'],
    });
    if (!invoice) {
      throw new NotFoundException('Facture non trouvee');
    }
    return invoice;
  }

  /**
   * Seul changement autorisé sur une facture émise : son état de règlement.
   * Le contenu est immuable (pas de PATCH, pas de DELETE) — c'est ce qui rend la
   * numérotation continue vérifiable. Une annulation exige légalement un avoir,
   * non implémenté (cf. tasks/todo.md §PRO-4).
   */
  async updateStatus(
    id: string,
    organizationId: string,
    dto: UpdateInvoiceStatusDto,
  ): Promise<Invoice> {
    const invoice = await this.findOneForOrg(id, organizationId);

    invoice.status = dto.status;
    invoice.paid_at =
      dto.status === InvoiceStatus.PAID
        ? new Date(dto.paid_at ?? Date.now())
        : null;

    return this.repo.save(invoice);
  }

  /**
   * Alloue le prochain numéro de la séquence (organisation, année).
   *
   * La séquence est clé sur l'**organisation** depuis PLAT-4, et non plus sur
   * l'utilisateur : la continuité exigée par l'art. 242 nonies A CGI porte sur
   * l'émetteur légal. Restée sur `user_id`, deux salariés d'une même entreprise
   * auraient chacun émis leur `F-2026-0001`.
   *
   * `ON CONFLICT DO UPDATE` prend un verrou de ligne : deux allocations
   * concurrentes se sérialisent, et un rollback restitue le numéro. Doit être
   * appelé avec le `manager` de la transaction en cours — `dataSource.query()`
   * emprunterait une autre connexion du pool et tournerait hors transaction,
   * ce qui réintroduirait des trous.
   */
  private async allocateNumber(
    manager: EntityManager,
    organizationId: string,
    year: number,
  ): Promise<number> {
    const rows = await manager.query<{ last_number: number }[]>(
      `INSERT INTO "invoice_sequences" ("organization_id", "year", "last_number")
       VALUES ($1, $2, 1)
       ON CONFLICT ("organization_id", "year")
       DO UPDATE SET "last_number" = "invoice_sequences"."last_number" + 1
       RETURNING "last_number"`,
      [organizationId, year],
    );
    return Number(rows[0].last_number);
  }

  /**
   * Lignes de facture. Deux écarts assumés avec le devis :
   * - la remise, appliquée au total sur le devis, devient une ligne négative en
   *   montant, pour que `Σ line_total_ht === quote.total_ht` exactement.
   * - chaque ligne de MO du devis (`labor_items_json`, E2-3) devient sa propre
   *   ligne de facture — le total de MO utilisé pour la remise vient des lignes
   *   réellement empilées ci-dessous, jamais de `quote.subtotal_labor_ht`
   *   directement, pour que la cohérence reste locale à cette fonction.
   */
  private buildLineItems(quote: Quote, vatRate: number): InvoiceLineItem[] {
    const items: InvoiceLineItem[] = quote.items_json.map((item) => ({
      kind: 'material' as const,
      label: item.material_name,
      description: item.packaging_label || null,
      quantity: item.units_needed,
      unit: item.packaging_label || null,
      unit_price_ht: Number(item.unit_price_with_margin),
      line_total_ht: Number(item.line_total_ht),
      tva_rate: vatRate,
    }));

    let laborTotal = 0;
    for (const line of quote.labor_items_json) {
      const lineTotal = round2(Number(line.line_total_ht) || 0);
      if (lineTotal === 0) continue;
      laborTotal = round2(laborTotal + lineTotal);
      const room = line.room_name ? ` — ${line.room_name}` : '';
      items.push({
        kind: 'labor',
        label: `${line.label}${room}`,
        description:
          line.kind === 'hourly'
            ? `${Number(line.quantity)} h x ${Number(line.unit_price_ht)} EUR/h`
            : 'Forfait',
        quantity: line.kind === 'hourly' ? Number(line.quantity) : 1,
        unit: line.kind === 'hourly' ? 'h' : 'forfait',
        unit_price_ht: Number(line.unit_price_ht),
        line_total_ht: lineTotal,
        tva_rate: vatRate,
      });
    }

    const grossHt =
      round2(Number(quote.subtotal_materials_ht) || 0) + laborTotal;
    const discount = round2((Number(quote.total_ht) || 0) - grossHt);
    if (discount !== 0) {
      items.push({
        kind: 'discount',
        label: `Remise (${Number(quote.discount_percent) || 0} %)`,
        description: null,
        quantity: 1,
        unit: null,
        unit_price_ht: discount,
        line_total_ht: discount,
        tva_rate: vatRate,
      });
    }

    return items;
  }

  private buildVatBreakdown(
    totalHt: number,
    totalTva: number,
    vatRate: number,
    vatExempt: boolean,
  ): VatBreakdownEntry[] {
    return [
      {
        rate: vatRate,
        base_ht: totalHt,
        tva_amount: totalTva,
        ...(vatExempt ? { exemption_reason: VAT_EXEMPTION_REASON } : {}),
      },
    ];
  }

  private buildSellerSnapshot(profile: CompanyProfile): InvoicePartySnapshot {
    return {
      name: profile.raison_sociale,
      address_line1: profile.address_line1,
      address_line2: profile.address_line2,
      postal_code: profile.postal_code,
      city: profile.city,
      country: profile.country,
      email: profile.email,
      phone: profile.phone,
      siret: profile.siret,
      siren: profile.siret ? profile.siret.slice(0, 9) : null,
      vat_number: profile.vat_number,
      vat_exempt: profile.vat_exempt,
      legal_form: profile.legal_form,
      capital_social:
        profile.capital_social === null ? null : Number(profile.capital_social),
      rcs_city: profile.rcs_city,
      rm_department: profile.rm_department,
      insurance_name: profile.insurance_name,
      insurance_policy: profile.insurance_policy,
      insurance_coverage: profile.insurance_coverage,
      iban: profile.iban,
      bic: profile.bic,
    };
  }

  private buildBuyerSnapshot(client: Client | null): InvoicePartySnapshot {
    if (!client) {
      return {
        name: 'Client particulier',
        address_line1: null,
        address_line2: null,
        postal_code: null,
        city: null,
        country: 'FR',
        email: null,
        phone: null,
        siret: null,
        siren: null,
        vat_number: null,
        is_company: false,
      };
    }

    return {
      name: client.name,
      address_line1: client.address_line1,
      address_line2: client.address_line2,
      postal_code: client.postal_code,
      city: client.city,
      country: client.country ?? 'FR',
      email: client.email,
      phone: client.phone,
      siret: client.siret,
      siren: client.siret ? client.siret.slice(0, 9) : null,
      vat_number: client.vat_number,
      is_company: client.is_company,
    };
  }

  /**
   * Date du jour en Europe/Paris au format `YYYY-MM-DD`. Sur un serveur en UTC,
   * `getFullYear()` renverrait l'année précédente entre 23 h et minuit fin
   * décembre — et ferait émettre un `F-2026-xxxx` après un `F-2027-0001`.
   */
  private todayInParis(): string {
    return new Date().toLocaleDateString('en-CA', {
      timeZone: 'Europe/Paris',
    });
  }

  private addDays(isoDate: string, days: number): string {
    const date = new Date(`${isoDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
}
