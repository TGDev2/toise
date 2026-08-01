import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, QueryFailedError, Repository } from 'typeorm';
import {
  EnterpriseAgreement,
  EnterpriseAgreementStatus,
} from './entities/enterprise-agreement.entity';
import { CreateEnterpriseAgreementDto } from './dto/create-enterprise-agreement.dto';
import { UpdateEnterpriseAgreementDto } from './dto/update-enterprise-agreement.dto';

/** Projection rendue à l'organisation cliente : ni notes internes, ni auteur. */
export interface EnterpriseAgreementView {
  id: string;
  status: EnterpriseAgreementStatus;
  starts_at: Date;
  ends_at: Date;
  /** `status = active` **et** date du jour dans la période (PLAT-6 D14). */
  is_current: boolean;
  days_until_expiry: number;
  annual_amount_cents: number;
  currency: string;
  quote_reference: string;
  purchase_order_reference: string | null;
  billing_contact_email: string;
  sla: {
    uptime_target: number | null;
    support_response_hours: number | null;
    support_email: string | null;
  };
  dedicated_environment: boolean;
  dedicated_environment_region: string | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Contrats Enterprise annuels négociés sur devis (BACKLOG PLAT-6).
 *
 * Le contrat est l'unique porteur de l'habilitation `enterprise` : c'est
 * `OrgContextService` qui le lit pour résoudre le palier de l'organisation
 * (PLAT-6 D1). Deux invariants tiennent le reste :
 *
 * - **une seule ligne `active` par organisation**, garantie par l'index partiel
 *   `UQ_enterprise_agreements_active_org` — la contrainte est dans la base, pas
 *   seulement ici, donc deux créations concurrentes ne peuvent pas la contourner ;
 * - **l'expiration se dérive de `ends_at`**, elle n'est jamais stockée : aucun
 *   sweep, donc aucune fenêtre pendant laquelle la base ment sur l'habilitation.
 */
@Injectable()
export class EnterpriseAgreementsService {
  private readonly logger = new Logger(EnterpriseAgreementsService.name);

  constructor(
    @InjectRepository(EnterpriseAgreement)
    private readonly agreementsRepo: Repository<EnterpriseAgreement>,
  ) {}

  async create(
    dto: CreateEnterpriseAgreementDto,
    createdByUserId: string,
  ): Promise<EnterpriseAgreement> {
    const startsAt = new Date(dto.starts_at);
    const endsAt = new Date(dto.ends_at);
    this.assertPeriod(startsAt, endsAt);

    try {
      const saved = await this.agreementsRepo.save(
        this.agreementsRepo.create({
          organization_id: dto.organization_id,
          status: EnterpriseAgreementStatus.DRAFT,
          starts_at: startsAt,
          ends_at: endsAt,
          annual_amount_cents: dto.annual_amount_cents,
          currency: (dto.currency ?? 'EUR').toUpperCase(),
          quote_reference: dto.quote_reference.trim(),
          purchase_order_reference:
            dto.purchase_order_reference?.trim() ?? null,
          billing_contact_email: dto.billing_contact_email.toLowerCase(),
          sla_uptime_target: dto.sla_uptime_target?.toFixed(2) ?? null,
          sla_support_response_hours: dto.sla_support_response_hours ?? null,
          sla_support_email: dto.sla_support_email?.toLowerCase() ?? null,
          dedicated_environment: dto.dedicated_environment ?? false,
          dedicated_environment_region:
            dto.dedicated_environment_region?.trim() ?? null,
          notes: dto.notes?.trim() ?? null,
          created_by_user_id: createdByUserId,
        }),
      );

      this.logger.log(
        `Contrat Enterprise ${saved.id} créé pour l'organisation ${dto.organization_id}`,
      );
      return saved;
    } catch (error) {
      throw this.translateOverlap(error);
    }
  }

  /**
   * L'activation est le geste qui ouvre réellement le palier : elle est séparée
   * de la création pour qu'un contrat en cours de rédaction n'habilite rien.
   */
  async update(
    id: string,
    dto: UpdateEnterpriseAgreementDto,
  ): Promise<EnterpriseAgreement> {
    const agreement = await this.findByIdOrFail(id);

    if (dto.starts_at !== undefined)
      agreement.starts_at = new Date(dto.starts_at);
    if (dto.ends_at !== undefined) agreement.ends_at = new Date(dto.ends_at);
    this.assertPeriod(agreement.starts_at, agreement.ends_at);

    if (dto.status !== undefined) agreement.status = dto.status;
    if (dto.annual_amount_cents !== undefined)
      agreement.annual_amount_cents = dto.annual_amount_cents;
    if (dto.currency !== undefined)
      agreement.currency = dto.currency.toUpperCase();
    if (dto.quote_reference !== undefined)
      agreement.quote_reference = dto.quote_reference.trim();
    if (dto.purchase_order_reference !== undefined)
      agreement.purchase_order_reference = dto.purchase_order_reference.trim();
    if (dto.billing_contact_email !== undefined)
      agreement.billing_contact_email = dto.billing_contact_email.toLowerCase();
    if (dto.sla_uptime_target !== undefined)
      agreement.sla_uptime_target = dto.sla_uptime_target.toFixed(2);
    if (dto.sla_support_response_hours !== undefined)
      agreement.sla_support_response_hours = dto.sla_support_response_hours;
    if (dto.sla_support_email !== undefined)
      agreement.sla_support_email = dto.sla_support_email.toLowerCase();
    if (dto.dedicated_environment !== undefined)
      agreement.dedicated_environment = dto.dedicated_environment;
    if (dto.dedicated_environment_region !== undefined)
      agreement.dedicated_environment_region =
        dto.dedicated_environment_region.trim();
    if (dto.notes !== undefined) agreement.notes = dto.notes.trim();

    try {
      return await this.agreementsRepo.save(agreement);
    } catch (error) {
      throw this.translateOverlap(error);
    }
  }

  /**
   * Résiliation : le palier retombe au prochain appel, sans sweep. La ligne est
   * conservée — l'historique contractuel d'un client à 10 k€/an ne se supprime pas.
   */
  async terminate(id: string): Promise<EnterpriseAgreement> {
    const agreement = await this.findByIdOrFail(id);
    agreement.status = EnterpriseAgreementStatus.TERMINATED;
    const saved = await this.agreementsRepo.save(agreement);
    this.logger.log(`Contrat Enterprise ${id} résilié`);
    return saved;
  }

  /**
   * Liste d'administration. `expiring_within_days` donne la file de
   * renouvellement : c'est ce qui remplace, pour l'instant, un sweep de relance
   * (cf. tasks/todo.md §PLAT-6 §7).
   */
  async listForAdmin(
    expiringWithinDays?: number,
  ): Promise<EnterpriseAgreement[]> {
    if (expiringWithinDays === undefined) {
      return this.agreementsRepo.find({ order: { ends_at: 'ASC' } });
    }

    const horizon = new Date(Date.now() + expiringWithinDays * MS_PER_DAY);
    return this.agreementsRepo.find({
      where: {
        status: EnterpriseAgreementStatus.ACTIVE,
        ends_at: LessThanOrEqual(horizon),
      },
      order: { ends_at: 'ASC' },
    });
  }

  /**
   * Contrat courant d'une organisation, pour sa propre lecture. Le filtre
   * `organization_id` est la barrière anti-IDOR : aucun identifiant de contrat
   * n'est accepté depuis le client sur cette surface.
   */
  async findCurrentForOrganization(
    organizationId: string,
  ): Promise<EnterpriseAgreement> {
    const agreement = await this.agreementsRepo.findOne({
      where: {
        organization_id: organizationId,
        status: EnterpriseAgreementStatus.ACTIVE,
      },
    });
    if (!agreement) {
      throw new NotFoundException(
        'Aucun contrat Enterprise pour cette organisation',
      );
    }
    return agreement;
  }

  toView(agreement: EnterpriseAgreement): EnterpriseAgreementView {
    const now = Date.now();
    const endsAt = new Date(agreement.ends_at).getTime();
    const startsAt = new Date(agreement.starts_at).getTime();

    return {
      id: agreement.id,
      status: agreement.status,
      starts_at: agreement.starts_at,
      ends_at: agreement.ends_at,
      is_current:
        agreement.status === EnterpriseAgreementStatus.ACTIVE &&
        startsAt <= now &&
        endsAt > now,
      days_until_expiry: Math.max(0, Math.ceil((endsAt - now) / MS_PER_DAY)),
      annual_amount_cents: agreement.annual_amount_cents,
      currency: agreement.currency,
      quote_reference: agreement.quote_reference,
      purchase_order_reference: agreement.purchase_order_reference,
      billing_contact_email: agreement.billing_contact_email,
      sla: {
        // `numeric` revient en `string` du driver `pg` : sans cette conversion la
        // réponse JSON annoncerait « "99.90" » là où un nombre est attendu.
        uptime_target:
          agreement.sla_uptime_target === null
            ? null
            : Number(agreement.sla_uptime_target),
        support_response_hours: agreement.sla_support_response_hours,
        support_email: agreement.sla_support_email,
      },
      dedicated_environment: agreement.dedicated_environment,
      dedicated_environment_region: agreement.dedicated_environment_region,
    };
  }

  // ---------------------------------------------------------------------------

  private async findByIdOrFail(id: string): Promise<EnterpriseAgreement> {
    const agreement = await this.agreementsRepo.findOne({ where: { id } });
    if (!agreement) {
      throw new NotFoundException('Contrat introuvable');
    }
    return agreement;
  }

  private assertPeriod(startsAt: Date, endsAt: Date): void {
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('Dates de contrat invalides');
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException(
        'La fin du contrat doit être postérieure à son début',
      );
    }
  }

  /**
   * La violation de `UQ_enterprise_agreements_active_org` est la seule attendue
   * ici. La traduire donne un motif actionnable — prolonger ou résilier le
   * contrat en cours — au lieu d'un 500 opaque.
   */
  private translateOverlap(error: unknown): unknown {
    if (
      error instanceof QueryFailedError &&
      error.message.includes('UQ_enterprise_agreements_active_org')
    ) {
      return new ConflictException({
        message:
          'Cette organisation a déjà un contrat actif. Prolongez-le ou résiliez-le avant d’en activer un autre.',
        error: 'ENTERPRISE_AGREEMENT_OVERLAP',
      });
    }
    return error;
  }
}
