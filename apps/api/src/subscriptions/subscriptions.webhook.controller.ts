import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  Logger,
  RawBody,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
@SkipThrottle()
export class SubscriptionsWebhookController {
  private readonly logger = new Logger(SubscriptionsWebhookController.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('webhook')
  async handleWebhook(
    @RawBody() rawBody: Buffer,
    @Headers('stripe-signature') signature: string,
    @Res() res: Response,
  ): Promise<void> {
    let event;

    try {
      event = this.subscriptionsService.constructWebhookEvent(
        rawBody,
        signature,
      );
    } catch (err) {
      this.logger.warn(
        `Webhook signature verification failed: ${(err as Error).message}`,
      );
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    try {
      await this.subscriptionsService.handleWebhookEvent(event);
    } catch (err) {
      this.logger.error(
        `Error processing webhook event ${event.type}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      res.status(500).json({ error: 'Webhook processing failed' });
      return;
    }

    res.status(200).json({ received: true });
  }
}
