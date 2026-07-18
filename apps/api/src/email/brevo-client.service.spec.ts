import { of } from 'rxjs';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { BrevoClientService } from './brevo-client.service';

const httpServiceMock = {
  post: jest.fn(),
};

function makeConfigMock(overrides: Record<string, unknown> = {}) {
  const map: Record<string, unknown> = {
    'brevo.apiKey': 'test-api-key',
    'brevo.senderEmail': 'estimations@chiffreo.fr',
    'brevo.senderName': 'Chiffréo',
    ...overrides,
  };
  return {
    get: jest.fn(
      (key: string, defaultValue?: unknown) => map[key] ?? defaultValue,
    ),
  };
}

async function createService(
  configOverrides: Record<string, unknown> = {},
): Promise<BrevoClientService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      BrevoClientService,
      { provide: HttpService, useValue: httpServiceMock },
      { provide: ConfigService, useValue: makeConfigMock(configOverrides) },
    ],
  }).compile();

  return module.get(BrevoClientService);
}

describe('BrevoClientService.sendTransactionalEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    httpServiceMock.post.mockReturnValue(of({ data: { messageId: 'abc' } }));
  });

  it('posts to the Brevo transactional email endpoint with the api key header and expected body', async () => {
    const service = await createService();

    await service.sendTransactionalEmail({
      to: 'visiteur@example.fr',
      subject: 'Votre estimation',
      html: '<p>Hello</p>',
      text: 'Hello',
    });

    expect(httpServiceMock.post).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({
        sender: { name: 'Chiffréo', email: 'estimations@chiffreo.fr' },
        to: [{ email: 'visiteur@example.fr' }],
        subject: 'Votre estimation',
        htmlContent: '<p>Hello</p>',
        textContent: 'Hello',
      }),
      expect.objectContaining({
        headers: { 'api-key': 'test-api-key' },
      }),
    );
  });

  it('throws ServiceUnavailableException without calling the API when the api key is missing', async () => {
    const service = await createService({ 'brevo.apiKey': undefined });

    await expect(
      service.sendTransactionalEmail({
        to: 'visiteur@example.fr',
        subject: 'Votre estimation',
        html: '<p>Hello</p>',
        text: 'Hello',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(httpServiceMock.post).not.toHaveBeenCalled();
  });

  it('throws ServiceUnavailableException without calling the API when the sender email is missing', async () => {
    const service = await createService({ 'brevo.senderEmail': undefined });

    await expect(
      service.sendTransactionalEmail({
        to: 'visiteur@example.fr',
        subject: 'Votre estimation',
        html: '<p>Hello</p>',
        text: 'Hello',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(httpServiceMock.post).not.toHaveBeenCalled();
  });
});
