import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { Quote, QuoteStatus } from '../quotes/entities/quote.entity';
import { FeatureGatesService } from '../feature-gates/feature-gates.service';
import { CompanyProfilesService } from '../company-profiles/company-profiles.service';
import { EmailService } from '../email/email.service';

type ReminderMilestone = 7 | 14;

/**
 * BACKLOG PRO-3 : relances devis. Sweep quotidien (pas de déclenchement par
 * requête HTTP — un devis "envoyé" doit être relancé même si l'artisan ne se
 * reconnecte pas à l'app) sur les devis au statut `sent` sans réponse depuis
 * 7 ou 14 jours.
 *
 * Politique de stamp : `reminder_7d_sent_at`/`reminder_14d_sent_at` sont
 * toujours marquées après tentative, même si les deux envois e-mail
 * échouent — évite qu'une panne du provider fasse grossir indéfiniment le lot
 * rejoué chaque jour (cf. migration 1711468800040). Seul le refus de la
 * feature gate laisse la colonne à `null`, pour permettre un rattrapage
 * automatique si l'artisan change de palier.
 */
@Injectable()
export class QuoteRemindersService {
  private readonly logger = new Logger(QuoteRemindersService.name);

  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,
    private readonly featureGatesService: FeatureGatesService,
    private readonly companyProfilesService: CompanyProfilesService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { timeZone: 'Europe/Paris' })
  async runDailySweep(): Promise<void> {
    await this.sweepThreshold(7);
    await this.sweepThreshold(14);
  }

  private async sweepThreshold(days: ReminderMilestone): Promise<void> {
    const quotes = await this.findDueQuotes(days);
    for (const quote of quotes) {
      try {
        await this.remindOne(quote, days);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Echec de la relance J+${days} pour le devis ${quote.id}: ${message}`,
        );
      }
    }
  }

  private async findDueQuotes(days: ReminderMilestone): Promise<Quote[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.quoteRepo.find({
      where: {
        status: QuoteStatus.SENT,
        sent_at: LessThanOrEqual(cutoff),
        ...(days === 7
          ? { reminder_7d_sent_at: IsNull() }
          : { reminder_14d_sent_at: IsNull() }),
      },
      relations: ['user', 'client'],
    });
  }

  private async remindOne(
    quote: Quote,
    days: ReminderMilestone,
  ): Promise<void> {
    const allowed = await this.featureGatesService.isFeatureAllowed(
      'quote_reminders',
      quote.user.subscription_tier,
    );
    if (!allowed) {
      return;
    }

    const totalTtc = Number(quote.total_ttc);

    if (quote.client?.email) {
      try {
        const companyProfile = await this.companyProfilesService.findByUserId(
          quote.user_id,
        );
        await this.emailService.sendQuoteReminderClientEmail(
          quote.client.email,
          {
            quoteNumber: quote.quote_number,
            totalTtc,
            daysSinceSent: days,
            companyName: companyProfile?.raison_sociale ?? null,
            contractorEmail: quote.user.email,
            contractorPhone: companyProfile?.phone ?? null,
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Echec de l'e-mail client (relance J+${days}) pour le devis ${quote.id}: ${message}`,
        );
      }
    }

    if (quote.user.email) {
      try {
        const publicUrl = this.config.get<string>('publicUrl');
        await this.emailService.sendQuoteReminderContractorEmail(
          quote.user.email,
          {
            quoteNumber: quote.quote_number,
            totalTtc,
            daysSinceSent: days,
            clientName: quote.client?.name ?? null,
            quoteUrl: `${publicUrl}/quotes/${quote.id}`,
          },
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Echec de l'e-mail artisan (relance J+${days}) pour le devis ${quote.id}: ${message}`,
        );
      }
    }

    if (days === 7) {
      quote.reminder_7d_sent_at = new Date();
    } else {
      quote.reminder_14d_sent_at = new Date();
    }
    await this.quoteRepo.save(quote);
  }
}
