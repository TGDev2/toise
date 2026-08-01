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
}
