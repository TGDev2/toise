import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { BrevoClientService } from './brevo-client.service';
import { EstimationLineItem } from '../estimations/entities/estimation-result.entity';

interface SentEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const brevoClientMock = {
  sendTransactionalEmail: jest.fn(),
};

function makeItem(
  overrides: Partial<EstimationLineItem> = {},
): EstimationLineItem {
  return {
    work_item_id: 'public',
    work_type_code: 'wall_painting',
    work_type_label: 'Peinture murale',
    material_id: 'mat-paint',
    material_name: 'Peinture acrylique mate',
    material_unit: 'L',
    gross_surface_m2: 12,
    surface_m2: 10,
    theoretical_qty: 1,
    waste_factor_percent: 5,
    waste_factor_source: 'catalog',
    adjusted_qty: 1.05,
    packaging_label: 'Pot 2,5 L',
    packaging_qty_per_unit: 2.5,
    units_needed: 1,
    pose_type: 'standard',
    ...overrides,
  };
}

describe('EmailService.sendCalculatorResultEmail', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    brevoClientMock.sendTransactionalEmail.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: BrevoClientService, useValue: brevoClientMock },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  it('builds a subject containing the work type label and forwards it to the Brevo client', async () => {
    await service.sendCalculatorResultEmail('visiteur@example.fr', {
      workTypeLabel: 'Peinture murale',
      items: [makeItem()],
    });

    expect(brevoClientMock.sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'visiteur@example.fr',
        subject: 'Votre estimation Chiffréo — Peinture murale',
      }),
    );
  });

  it('includes each item name and quantity in both the html and text bodies', async () => {
    await service.sendCalculatorResultEmail('visiteur@example.fr', {
      workTypeLabel: 'Peinture murale',
      items: [
        makeItem({ material_name: 'Peinture acrylique mate', units_needed: 3 }),
      ],
    });

    const [sent] = brevoClientMock.sendTransactionalEmail.mock.calls[0] as [
      SentEmail,
    ];
    expect(sent.html).toContain('Peinture acrylique mate');
    expect(sent.html).toContain('3');
    expect(sent.text).toContain('Peinture acrylique mate');
    expect(sent.text).toContain('3');
  });

  it('escapes HTML-significant characters in the html body but not in the text body', async () => {
    await service.sendCalculatorResultEmail('visiteur@example.fr', {
      workTypeLabel: 'Peinture murale',
      items: [makeItem({ material_name: 'Peinture <Pro> & fils' })],
    });

    const [sent] = brevoClientMock.sendTransactionalEmail.mock.calls[0] as [
      SentEmail,
    ];
    expect(sent.html).not.toContain('<Pro>');
    expect(sent.html).toContain('&lt;Pro&gt;');
    expect(sent.text).toContain('Peinture <Pro> & fils');
  });
});
