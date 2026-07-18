import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface TransactionalEmailRequest {
  to: string;
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class BrevoClientService {
  private static readonly BASE_URL = 'https://api.brevo.com/v3';

  private readonly logger = new Logger(BrevoClientService.name);
  private readonly apiKey: string | null;
  private readonly senderEmail: string | null;
  private readonly senderName: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('brevo.apiKey');
    const senderEmail = this.config.get<string>('brevo.senderEmail');
    if (apiKey && senderEmail) {
      this.apiKey = apiKey;
      this.senderEmail = senderEmail;
    } else {
      // La validation d'env garantit ces valeurs en production ; en dev,
      // l'app démarre sans Brevo et l'envoi d'e-mail est désactivé.
      this.apiKey = null;
      this.senderEmail = null;
      this.logger.warn(
        'BREVO_API_KEY ou BREVO_SENDER_EMAIL absent(e) — l’envoi d’e-mails est désactivé (dev uniquement).',
      );
    }
    this.senderName = this.config.get<string>('brevo.senderName', 'Chiffréo');
  }

  async sendTransactionalEmail(
    request: TransactionalEmailRequest,
  ): Promise<void> {
    if (!this.apiKey || !this.senderEmail) {
      throw new ServiceUnavailableException(
        'Le service d’e-mail est temporairement indisponible.',
      );
    }

    await firstValueFrom(
      this.httpService.post(
        `${BrevoClientService.BASE_URL}/smtp/email`,
        {
          sender: { name: this.senderName, email: this.senderEmail },
          to: [{ email: request.to }],
          subject: request.subject,
          htmlContent: request.html,
          textContent: request.text,
        },
        { headers: { 'api-key': this.apiKey }, timeout: 10000 },
      ),
    );
  }
}
