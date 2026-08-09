import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Between, In, IsNull, Not, Repository } from 'typeorm';
import { User, AuthProvider } from '../users/entities/user.entity';
import { Project, ProjectStatus } from '../projects/entities/project.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../subscriptions/entities/subscription.entity';
import {
  billingPeriodLabel,
  getDefaultPlan,
  RENEWAL_NOTICE_DAYS,
} from '../subscriptions/plans.constants';
import { EmailService } from '../email/email.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
import { LifecycleEmailSend } from './entities/lifecycle-email-send.entity';
import { LifecycleEmailType } from './lifecycle-email-type.enum';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * BACKLOG PLAT-2 : e-mails de cycle de vie. Sweep quotidien (même patron que
 * QuoteRemindersService, PRO-3) couvrant 5 déclencheurs indépendants :
 * onboarding J+1/J+3, projet abandonné à mi-parcours, chantier estimé jamais
 * clôturé (DATA-5), fin d'essai de l'offre payante.
 *
 * Les fenêtres des 4 sweeps rétrospectifs (onboarding ×2, abandon, clôture)
 * sont bornées haut ET bas (contrairement à PRO-3 qui n'a qu'un seuil bas) :
 * sans borne haute, le premier déploiement enverrait ces e-mails à tous les
 * comptes/projets existants d'un coup.
 *
 * Politique de stamp (table lifecycle_email_sends) : identique à PRO-3, la
 * ligne est insérée après tentative d'envoi, y compris en cas d'échec Brevo —
 * évite qu'une panne provider fasse rejouer indéfiniment le même lot.
 */
@Injectable()
export class LifecycleEmailsService {
  private readonly logger = new Logger(LifecycleEmailsService.name);
  private readonly publicUrl: string;
  private readonly paidPlanPriceEuros: number;
  /** « par an » — un montant sans sa période induit en erreur. */
  private readonly paidPlanPeriodLabel: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(LifecycleEmailSend)
    private readonly sendsRepo: Repository<LifecycleEmailSend>,
    private readonly emailService: EmailService,
    private readonly analyticsService: AnalyticsService,
    private readonly config: ConfigService,
  ) {
    this.publicUrl = this.config.get<string>('publicUrl')!;
    this.paidPlanPriceEuros = getDefaultPlan().price;
    this.paidPlanPeriodLabel = billingPeriodLabel(getDefaultPlan());
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { timeZone: 'Europe/Paris' })
  async runDailySweep(): Promise<void> {
    await this.sweepOnboarding(LifecycleEmailType.ONBOARDING_D1, 2, 1);
    await this.sweepOnboarding(LifecycleEmailType.ONBOARDING_D3, 4, 3);
    await this.sweepAbandonedProjects();
    await this.sweepCloseoutDue();
    await this.sweepTrialEndingSoon();
    await this.sweepRenewalNotice();
  }

  // --- Préavis de reconduction annuelle (E3-3) --------------------------------

  /**
   * Prévient un abonné actif que son année se reconduit, 30 jours avant.
   *
   * Ce balayage n'existait pas tant que l'offre était mensuelle : à 19 €,
   * personne ne conteste une reconduction. Sur un prélèvement unique de 279 €
   * une fois l'an, l'absence de préavis est la première cause de demande de
   * remboursement — et, à défaut, de contestation bancaire, qui coûte plus cher
   * que le remboursement qu'elle remplace.
   *
   * **Le dédoublonnage ne passe pas par `lifecycle_email_sends`**, à la
   * différence des cinq autres relances. Son index unique partiel
   * `(user_id, email_type) WHERE project_id IS NULL` ne laisse partir un
   * e-mail « par compte » qu'une seule fois pour toujours : l'abonné aurait été
   * prévenu la première année et jamais plus, une panne qui ne se serait vue
   * qu'au bout de deux ans. La clé exacte est la **période annoncée**, portée
   * par `subscriptions.renewal_notice_sent_for`, qui se réarme à chaque
   * échéance.
   *
   * Pas de préavis quand `cancel_at_period_end` est posé : il n'y a rien à
   * reconduire, et annoncer un prélèvement à quelqu'un qui a déjà résilié est
   * la meilleure façon de déclencher l'appel qu'on cherche à éviter.
   *
   * Fenêtre bornée en bas par « maintenant » : une échéance déjà passée que le
   * webhook n'aurait pas encore avancée ne doit pas déclencher un préavis pour
   * un prélèvement qui a déjà eu lieu.
   */
  private async sweepRenewalNotice(): Promise<void> {
    const now = new Date();
    const upper = new Date(now.getTime() + RENEWAL_NOTICE_DAYS * DAY_MS);

    const subscriptions = await this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        cancel_at_period_end: false,
        current_period_end: Between(now, upper),
      },
      relations: ['user'],
    });

    const due = subscriptions.filter(
      (s) =>
        s.user?.email &&
        s.current_period_end &&
        s.renewal_notice_sent_for?.getTime() !== s.current_period_end.getTime(),
    );

    for (const subscription of due) {
      try {
        await this.sendRenewalNoticeEmail(subscription);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Echec du préavis de reconduction pour l'abonnement ${subscription.id}: ${message}`,
        );
      }
    }
  }

  private async sendRenewalNoticeEmail(
    subscription: Subscription,
  ): Promise<void> {
    const renewsAt = subscription.current_period_end!;
    const daysRemaining = Math.max(
      1,
      Math.ceil((renewsAt.getTime() - Date.now()) / DAY_MS),
    );

    try {
      await this.emailService.sendRenewalNoticeEmail(subscription.user.email!, {
        daysRemaining,
        renewalDate: renewsAt.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
        priceEuros: this.paidPlanPriceEuros,
        billingPeriodLabel: this.paidPlanPeriodLabel,
        manageSubscriptionUrl: `${this.publicUrl}/subscription`,
      });
      this.analyticsService.track(
        AnalyticsEventName.RENEWAL_NOTICE_EMAIL_SENT,
        subscription.user_id,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Echec de l'e-mail de préavis pour l'abonnement ${subscription.id}: ${message}`,
      );
    }

    // Posé après tentative, y compris en cas d'échec du fournisseur : même
    // parti pris que les cinq autres relances, pour qu'une panne Brevo ne
    // fasse pas rejouer le même lot à chaque balayage.
    await this.subscriptionRepo.update(
      { id: subscription.id },
      { renewal_notice_sent_for: renewsAt },
    );
  }

  // --- Chantier estimé, jamais clôturé (DATA-5) ------------------------------

  /**
   * Relance unique sur un projet resté `estimated`.
   *
   * Fenêtre 14–45 jours après la dernière activité : avant 14 jours le
   * chantier est probablement encore en cours, après 45 la relance arrive trop
   * tard pour les enseignes au délai le plus court. Bornée des deux côtés,
   * comme les trois autres sweeps rétrospectifs — sans borne haute, le premier
   * déploiement écrirait à tous les projets estimés de l'historique.
   *
   * Aucun recouvrement avec `sweepAbandonedProjects` : celui-là ne regarde que
   * `draft` et `active`, celui-ci que `estimated`. Un projet ne peut pas être
   * dans les deux ensembles, et le stamp par (projet × type) rend de toute
   * façon chaque relance unique.
   */
  private async sweepCloseoutDue(): Promise<void> {
    const low = new Date();
    low.setDate(low.getDate() - 45);
    const high = new Date();
    high.setDate(high.getDate() - 14);

    const projects = await this.projectRepo.find({
      where: {
        updated_at: Between(low, high),
        status: ProjectStatus.ESTIMATED,
        deleted_at: IsNull(),
      },
      relations: ['user'],
    });

    // Même réserve que pour la relance d'abandon : la relance est nominative,
    // un projet dont l'auteur a supprimé son compte n'a plus de destinataire.
    const candidates = projects.filter((p): p is Project & { user: User } =>
      Boolean(p.user?.email),
    );
    if (candidates.length === 0) return;

    const alreadySent = await this.findSentProjectIds(
      LifecycleEmailType.CLOSEOUT_DUE,
      candidates.map((p) => p.id),
    );
    const due = candidates.filter((p) => !alreadySent.has(p.id));

    for (const project of due) {
      try {
        await this.sendCloseoutDueEmail(project);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Echec de la relance de clôture pour le projet ${project.id}: ${message}`,
        );
      }
    }
  }

  private async sendCloseoutDueEmail(
    project: Project & { user: User },
  ): Promise<void> {
    try {
      await this.emailService.sendCloseoutDueEmail(project.user.email!, {
        projectName: project.name,
        closeoutUrl: `${this.publicUrl}/projects/${project.id}/shopping-list/closeout`,
      });
      this.analyticsService.track(
        AnalyticsEventName.CLOSEOUT_DUE_EMAIL_SENT,
        project.user.id,
        { project_id: project.id },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Echec de l'e-mail de clôture pour le projet ${project.id}: ${message}`,
      );
    }

    await this.stamp(
      project.user.id,
      project.id,
      LifecycleEmailType.CLOSEOUT_DUE,
    );
  }

  // --- Onboarding J+1 / J+3 -------------------------------------------------

  private async sweepOnboarding(
    emailType:
      | LifecycleEmailType.ONBOARDING_D1
      | LifecycleEmailType.ONBOARDING_D3,
    maxDaysAgo: number,
    minDaysAgo: number,
  ): Promise<void> {
    const low = new Date();
    low.setDate(low.getDate() - maxDaysAgo);
    const high = new Date();
    high.setDate(high.getDate() - minDaysAgo);

    const users = await this.userRepo.find({
      where: {
        created_at: Between(low, high),
        email: Not(IsNull()),
        auth_provider: Not(AuthProvider.ANONYMOUS),
      },
    });
    if (users.length === 0) return;

    const alreadySent = await this.findSentUserIds(
      emailType,
      users.map((u) => u.id),
    );
    const due = users.filter((u) => !alreadySent.has(u.id));

    for (const user of due) {
      try {
        await this.sendOnboardingEmail(user, emailType);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Echec de l'e-mail ${emailType} pour l'utilisateur ${user.id}: ${message}`,
        );
      }
    }
  }

  private async sendOnboardingEmail(
    user: User,
    emailType:
      | LifecycleEmailType.ONBOARDING_D1
      | LifecycleEmailType.ONBOARDING_D3,
  ): Promise<void> {
    try {
      if (emailType === LifecycleEmailType.ONBOARDING_D1) {
        await this.emailService.sendOnboardingD1Email(user.email!, {
          dashboardUrl: `${this.publicUrl}/dashboard`,
        });
        this.analyticsService.track(
          AnalyticsEventName.ONBOARDING_D1_EMAIL_SENT,
          user.id,
        );
      } else {
        const hasProject =
          (await this.projectRepo.count({
            where: { user_id: user.id, deleted_at: IsNull() },
          })) > 0;
        await this.emailService.sendOnboardingD3Email(user.email!, {
          dashboardUrl: `${this.publicUrl}/dashboard`,
          hasProject,
        });
        this.analyticsService.track(
          AnalyticsEventName.ONBOARDING_D3_EMAIL_SENT,
          user.id,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Echec de l'envoi ${emailType} pour l'utilisateur ${user.id}: ${message}`,
      );
    }

    await this.stamp(user.id, null, emailType);
  }

  // --- Projet abandonné à mi-parcours ---------------------------------------

  private async sweepAbandonedProjects(): Promise<void> {
    const low = new Date();
    low.setDate(low.getDate() - 12);
    const high = new Date();
    high.setDate(high.getDate() - 5);

    const projects = await this.projectRepo.find({
      where: {
        created_at: Between(low, high),
        status: In([ProjectStatus.DRAFT, ProjectStatus.ACTIVE]),
        deleted_at: IsNull(),
      },
      relations: ['user'],
    });

    // Un projet dont l'auteur a supprimé son compte reste acquis à son
    // organisation, mais la relance est nominative : il n'y a plus personne à
    // relancer, ni de `user_id` à horodater dans `lifecycle_email_sends`.
    const candidates = projects.filter(
      (p): p is Project & { user: User } =>
        Boolean(p.user?.email) &&
        Boolean(p.rooms?.some((r) => r.dimensions !== null)),
    );
    if (candidates.length === 0) return;

    const alreadySent = await this.findSentProjectIds(
      LifecycleEmailType.PROJECT_ABANDONED,
      candidates.map((p) => p.id),
    );
    const due = candidates.filter((p) => !alreadySent.has(p.id));

    for (const project of due) {
      try {
        await this.sendProjectAbandonedEmail(project);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Echec de la relance projet abandonné pour le projet ${project.id}: ${message}`,
        );
      }
    }
  }

  private async sendProjectAbandonedEmail(
    project: Project & { user: User },
  ): Promise<void> {
    try {
      await this.emailService.sendProjectAbandonedEmail(project.user.email!, {
        projectName: project.name,
        projectUrl: `${this.publicUrl}/projects/${project.id}`,
      });
      this.analyticsService.track(
        AnalyticsEventName.PROJECT_ABANDONED_EMAIL_SENT,
        project.user.id,
        { project_id: project.id },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Echec de l'e-mail projet abandonné pour le projet ${project.id}: ${message}`,
      );
    }

    await this.stamp(
      project.user.id,
      project.id,
      LifecycleEmailType.PROJECT_ABANDONED,
    );
  }

  // --- Fin d'essai de l'offre payante -------------------------------------------------------

  private async sweepTrialEndingSoon(): Promise<void> {
    const now = new Date();
    const upper = new Date();
    upper.setDate(upper.getDate() + 3);

    const subscriptions = await this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.TRIALING,
        trial_end: Between(now, upper),
      },
      relations: ['user'],
    });

    const candidates = subscriptions.filter((s) => s.user?.email);
    if (candidates.length === 0) return;

    const alreadySent = await this.findSentUserIds(
      LifecycleEmailType.TRIAL_ENDING_SOON,
      candidates.map((s) => s.user_id),
    );
    const due = candidates.filter((s) => !alreadySent.has(s.user_id));

    for (const subscription of due) {
      try {
        await this.sendTrialEndingSoonEmail(subscription);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Echec de la relance fin d'essai pour l'abonnement ${subscription.id}: ${message}`,
        );
      }
    }
  }

  private async sendTrialEndingSoonEmail(
    subscription: Subscription,
  ): Promise<void> {
    const daysRemaining = Math.max(
      1,
      Math.ceil((subscription.trial_end!.getTime() - Date.now()) / DAY_MS),
    );

    try {
      await this.emailService.sendTrialEndingSoonEmail(
        subscription.user.email!,
        {
          daysRemaining,
          priceEuros: this.paidPlanPriceEuros,
          billingPeriodLabel: this.paidPlanPeriodLabel,
          manageSubscriptionUrl: `${this.publicUrl}/subscription`,
        },
      );
      this.analyticsService.track(
        AnalyticsEventName.TRIAL_ENDING_EMAIL_SENT,
        subscription.user_id,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Echec de l'e-mail fin d'essai pour l'abonnement ${subscription.id}: ${message}`,
      );
    }

    await this.stamp(
      subscription.user_id,
      null,
      LifecycleEmailType.TRIAL_ENDING_SOON,
    );
  }

  // --- Idempotence -----------------------------------------------------------

  private async findSentUserIds(
    emailType: LifecycleEmailType,
    userIds: string[],
  ): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const rows = await this.sendsRepo.find({
      where: {
        email_type: emailType,
        user_id: In(userIds),
        project_id: IsNull(),
      },
      select: ['user_id'],
    });
    return new Set(rows.map((r) => r.user_id));
  }

  private async findSentProjectIds(
    emailType: LifecycleEmailType,
    projectIds: string[],
  ): Promise<Set<string>> {
    if (projectIds.length === 0) return new Set();
    const rows = await this.sendsRepo.find({
      where: { email_type: emailType, project_id: In(projectIds) },
      select: ['project_id'],
    });
    return new Set(rows.map((r) => r.project_id as string));
  }

  private async stamp(
    userId: string,
    projectId: string | null,
    emailType: LifecycleEmailType,
  ): Promise<void> {
    await this.sendsRepo.save(
      this.sendsRepo.create({
        user_id: userId,
        project_id: projectId,
        email_type: emailType,
      }),
    );
  }
}
