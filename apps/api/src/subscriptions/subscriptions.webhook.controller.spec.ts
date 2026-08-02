import type { Response } from 'express';
import * as Sentry from '@sentry/node';
import { SubscriptionsWebhookController } from './subscriptions.webhook.controller';
import { SubscriptionsService } from './subscriptions.service';

jest.mock('@sentry/node');

// Pas de type de retour `Response` ici : le typage de l'interface Express
// déclare `status`/`json` en syntaxe méthode, ce qui déclenche
// @typescript-eslint/unbound-method sur `expect(res.status)...`. En gardant
// le type inféré de l'objet littéral (propriétés, pas méthodes), la règle
// n'a rien à signaler ; le cast vers `Response` n'a lieu qu'à l'appel.
function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe('SubscriptionsWebhookController', () => {
  let controller: SubscriptionsWebhookController;
  let service: {
    constructWebhookEvent: jest.Mock;
    claimWebhookEvent: jest.Mock;
    handleWebhookEvent: jest.Mock;
    releaseWebhookEvent: jest.Mock;
    markWebhookEventProcessed: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = {
      constructWebhookEvent: jest.fn(),
      claimWebhookEvent: jest.fn(),
      handleWebhookEvent: jest.fn(),
      releaseWebhookEvent: jest.fn(),
      markWebhookEventProcessed: jest.fn(),
    };
    controller = new SubscriptionsWebhookController(
      service as unknown as SubscriptionsService,
    );
  });

  it('signature invalide → 400, Sentry non appelé', async () => {
    service.constructWebhookEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const res = createResponse();

    await controller.handleWebhook(
      Buffer.from(''),
      'sig',
      res as unknown as Response,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('event dupliqué → 200, Sentry non appelé', async () => {
    const event = { id: 'evt_1', type: 'checkout.session.completed' };
    service.constructWebhookEvent.mockReturnValue(event);
    service.claimWebhookEvent.mockResolvedValue(false);
    const res = createResponse();

    await controller.handleWebhook(
      Buffer.from(''),
      'sig',
      res as unknown as Response,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      received: true,
      duplicate: true,
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('échec de traitement → libère l’event, 500, Sentry appelé avec le tag', async () => {
    const event = { id: 'evt_2', type: 'invoice.paid' };
    const processingError = new Error('handler failed');
    service.constructWebhookEvent.mockReturnValue(event);
    service.claimWebhookEvent.mockResolvedValue(true);
    service.handleWebhookEvent.mockRejectedValue(processingError);
    const res = createResponse();

    await controller.handleWebhook(
      Buffer.from(''),
      'sig',
      res as unknown as Response,
    );

    expect(service.releaseWebhookEvent).toHaveBeenCalledWith('evt_2');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Webhook processing failed',
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(processingError, {
      tags: { component: 'stripe-webhook' },
    });
  });

  /**
   * Le marquage est ce qui rend l'event définitivement non rejouable. Le poser
   * avant le traitement (ce que faisait la réservation seule) gelait tout event
   * dont le processus mourait en cours de route.
   */
  it('ne marque l’event traité qu’après le succès du traitement', async () => {
    const event = { id: 'evt_3', type: 'invoice.paid' };
    service.constructWebhookEvent.mockReturnValue(event);
    service.claimWebhookEvent.mockResolvedValue(true);
    const order: string[] = [];
    service.handleWebhookEvent.mockImplementation(() => {
      order.push('handle');
      return Promise.resolve();
    });
    service.markWebhookEventProcessed.mockImplementation(() => {
      order.push('mark');
      return Promise.resolve();
    });
    const res = createResponse();

    await controller.handleWebhook(
      Buffer.from(''),
      'sig',
      res as unknown as Response,
    );

    expect(order).toEqual(['handle', 'mark']);
    expect(service.markWebhookEventProcessed).toHaveBeenCalledWith('evt_3');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('ne marque rien quand le traitement échoue', async () => {
    const event = { id: 'evt_4', type: 'invoice.paid' };
    service.constructWebhookEvent.mockReturnValue(event);
    service.claimWebhookEvent.mockResolvedValue(true);
    service.handleWebhookEvent.mockRejectedValue(new Error('boom'));
    const res = createResponse();

    await controller.handleWebhook(
      Buffer.from(''),
      'sig',
      res as unknown as Response,
    );

    expect(service.markWebhookEventProcessed).not.toHaveBeenCalled();
  });
});
