import { Injectable } from '@nestjs/common';
import { BrevoClientService } from './brevo-client.service';
import {
  buildCalculatorResultEmail,
  CalculatorResultEmailData,
} from './templates/calculator-result.template';
import {
  buildQuoteReminderClientEmail,
  QuoteReminderClientEmailData,
} from './templates/quote-reminder-client.template';
import {
  buildQuoteReminderContractorEmail,
  QuoteReminderContractorEmailData,
} from './templates/quote-reminder-contractor.template';
import {
  buildReferralCreditEarnedEmail,
  ReferralCreditEarnedEmailData,
} from './templates/referral-credit-earned.template';
import {
  buildOnboardingD1Email,
  OnboardingD1EmailData,
} from './templates/onboarding-d1.template';
import {
  buildOnboardingD3Email,
  OnboardingD3EmailData,
} from './templates/onboarding-d3.template';
import {
  buildProjectAbandonedEmail,
  ProjectAbandonedEmailData,
} from './templates/project-abandoned.template';
import {
  buildTrialEndingSoonEmail,
  TrialEndingSoonEmailData,
} from './templates/trial-ending-soon.template';
import {
  buildOrganizationInvitationEmail,
  OrganizationInvitationEmailData,
} from './templates/organization-invitation.template';

@Injectable()
export class EmailService {
  constructor(private readonly brevoClient: BrevoClientService) {}

  async sendCalculatorResultEmail(
    to: string,
    data: CalculatorResultEmailData,
  ): Promise<void> {
    const { subject, html, text } = buildCalculatorResultEmail(data);
    await this.brevoClient.sendTransactionalEmail({ to, subject, html, text });
  }

  async sendQuoteReminderClientEmail(
    to: string,
    data: QuoteReminderClientEmailData,
  ): Promise<void> {
    const { subject, html, text } = buildQuoteReminderClientEmail(data);
    await this.brevoClient.sendTransactionalEmail({ to, subject, html, text });
  }

  async sendQuoteReminderContractorEmail(
    to: string,
    data: QuoteReminderContractorEmailData,
  ): Promise<void> {
    const { subject, html, text } = buildQuoteReminderContractorEmail(data);
    await this.brevoClient.sendTransactionalEmail({ to, subject, html, text });
  }

  async sendReferralCreditEmail(
    to: string,
    data: ReferralCreditEarnedEmailData,
  ): Promise<void> {
    const { subject, html, text } = buildReferralCreditEarnedEmail(data);
    await this.brevoClient.sendTransactionalEmail({ to, subject, html, text });
  }

  async sendOnboardingD1Email(
    to: string,
    data: OnboardingD1EmailData,
  ): Promise<void> {
    const { subject, html, text } = buildOnboardingD1Email(data);
    await this.brevoClient.sendTransactionalEmail({ to, subject, html, text });
  }

  async sendOnboardingD3Email(
    to: string,
    data: OnboardingD3EmailData,
  ): Promise<void> {
    const { subject, html, text } = buildOnboardingD3Email(data);
    await this.brevoClient.sendTransactionalEmail({ to, subject, html, text });
  }

  async sendProjectAbandonedEmail(
    to: string,
    data: ProjectAbandonedEmailData,
  ): Promise<void> {
    const { subject, html, text } = buildProjectAbandonedEmail(data);
    await this.brevoClient.sendTransactionalEmail({ to, subject, html, text });
  }

  async sendTrialEndingSoonEmail(
    to: string,
    data: TrialEndingSoonEmailData,
  ): Promise<void> {
    const { subject, html, text } = buildTrialEndingSoonEmail(data);
    await this.brevoClient.sendTransactionalEmail({ to, subject, html, text });
  }

  async sendOrganizationInvitationEmail(
    to: string,
    data: OrganizationInvitationEmailData,
  ): Promise<void> {
    const { subject, html, text } = buildOrganizationInvitationEmail(data);
    await this.brevoClient.sendTransactionalEmail({ to, subject, html, text });
  }
}
