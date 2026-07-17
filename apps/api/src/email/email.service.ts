import { Injectable } from '@nestjs/common';
import { BrevoClientService } from './brevo-client.service';
import {
  buildCalculatorResultEmail,
  CalculatorResultEmailData,
} from './templates/calculator-result.template';

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
}
