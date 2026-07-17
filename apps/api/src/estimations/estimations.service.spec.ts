import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EstimationsService } from './estimations.service';
import { EstimationEngine } from './estimation-engine';
import { EstimationResult } from './entities/estimation-result.entity';
import { EmailCapture } from './entities/email-capture.entity';
import {
  MaterialCatalog,
  MaterialCategory,
} from '../materials/entities/material-catalog.entity';
import { WorkType } from '../projects/entities/work-type.entity';
import { ProjectsService } from '../projects/projects.service';
import { EmailService } from '../email/email.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { SkillLevel } from '../projects/entities/project-work-item.entity';
import { PublicEstimateRequestDto } from './dto/public-estimate-request.dto';
import { PublicEstimateEmailDto } from './dto/public-estimate-email.dto';

const mockWorkType: WorkType = {
  id: 'wt-wall-painting',
  code: 'wall_painting',
  label_fr: 'Peinture murale',
  category: 'painting',
  surface_target: 'wall',
  waste_factor_base: 1.1,
  required_materials: [],
  contextual_questions: [],
  display_order: 1,
  created_at: new Date('2026-03-27T00:00:00.000Z'),
  updated_at: new Date('2026-03-27T00:00:00.000Z'),
};

const mockMaterial = {
  id: 'mat-paint',
  name: 'Peinture acrylique mate',
  category: MaterialCategory.PAINTING,
  unit: 'L',
  yield_per_unit: 10,
  is_active: true,
  waste_factors: [
    { pose_type: 'standard', skill_level: 'intermediate', factor_percent: 5 },
  ],
  packagings: [
    { label: 'Pot 10 L', quantity_per_unit: 10, unit: 'L' },
    { label: 'Pot 2,5 L', quantity_per_unit: 2.5, unit: 'L' },
  ],
} as unknown as MaterialCatalog;

const estimationRepoMock = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
};

const materialsRepoMock = {
  find: jest.fn().mockResolvedValue([mockMaterial]),
};

const workTypesRepoMock = {
  findOne: jest.fn().mockResolvedValue(mockWorkType),
};

const projectsServiceMock = {
  findOneByUser: jest.fn(),
  getWorkItems: jest.fn(),
  updateStatus: jest.fn(),
};

const emailCaptureRepoMock = {
  create: jest.fn(),
  save: jest.fn(),
};

const emailServiceMock = {
  sendCalculatorResultEmail: jest.fn(),
};

const analyticsServiceMock = {
  track: jest.fn(),
};

function makeDto(
  overrides: Partial<PublicEstimateRequestDto> = {},
): PublicEstimateRequestDto {
  return {
    length_cm: 400,
    width_cm: 300,
    height_cm: 250,
    openings: [{ width_cm: 90, height_cm: 210, count: 1 }],
    work_type_code: 'wall_painting',
    ...overrides,
  } as PublicEstimateRequestDto;
}

describe('EstimationsService.estimatePublic', () => {
  let service: EstimationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    materialsRepoMock.find.mockResolvedValue([mockMaterial]);
    workTypesRepoMock.findOne.mockResolvedValue(mockWorkType);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstimationsService,
        EstimationEngine,
        {
          provide: getRepositoryToken(EstimationResult),
          useValue: estimationRepoMock,
        },
        {
          provide: getRepositoryToken(MaterialCatalog),
          useValue: materialsRepoMock,
        },
        { provide: getRepositoryToken(WorkType), useValue: workTypesRepoMock },
        {
          provide: getRepositoryToken(EmailCapture),
          useValue: emailCaptureRepoMock,
        },
        { provide: ProjectsService, useValue: projectsServiceMock },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: AnalyticsService, useValue: analyticsServiceMock },
      ],
    }).compile();

    service = module.get(EstimationsService);
  });

  it('throws NotFoundException for an unknown work type code', async () => {
    workTypesRepoMock.findOne.mockResolvedValue(null);

    await expect(service.estimatePublic(makeDto())).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns line items without persisting anything', async () => {
    const result = await service.estimatePublic(makeDto());

    expect(result.work_type_code).toBe('wall_painting');
    expect(result.work_type_label).toBe('Peinture murale');
    expect(result.items).toHaveLength(1);
    expect(result.total_items).toBe(1);
    expect(result.items[0].material_name).toBe('Peinture acrylique mate');
    expect(estimationRepoMock.create).not.toHaveBeenCalled();
    expect(estimationRepoMock.save).not.toHaveBeenCalled();
    expect(projectsServiceMock.updateStatus).not.toHaveBeenCalled();
  });

  it('defaults skill level to intermediate and painting to 2 coats', async () => {
    const result = await service.estimatePublic(makeDto());

    expect(result.skill_level).toBe('intermediate');
    expect(result.items[0].number_of_coats).toBe(2);
  });

  it('honours the requested skill level and custom params', async () => {
    const result = await service.estimatePublic(
      makeDto({
        skill_level: SkillLevel.BEGINNER,
        custom_params: { number_of_coats: 3 },
      }),
    );

    expect(result.skill_level).toBe('beginner');
    expect(result.items[0].number_of_coats).toBe(3);
  });

  it('deducts openings from the wall surface', async () => {
    const withOpenings = await service.estimatePublic(makeDto());
    const withoutOpenings = await service.estimatePublic(
      makeDto({ openings: [] }),
    );

    expect(withOpenings.items[0].surface_m2).toBeLessThan(
      withoutOpenings.items[0].surface_m2,
    );
  });
});

function makeEmailDto(
  overrides: Partial<PublicEstimateEmailDto> = {},
): PublicEstimateEmailDto {
  return {
    ...makeDto(),
    email: 'visiteur@example.fr',
    consent: true,
    ...overrides,
  } as PublicEstimateEmailDto;
}

describe('EstimationsService.emailEstimate', () => {
  let service: EstimationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    materialsRepoMock.find.mockResolvedValue([mockMaterial]);
    workTypesRepoMock.findOne.mockResolvedValue(mockWorkType);
    emailCaptureRepoMock.create.mockImplementation(
      (data: Record<string, unknown>) => data,
    );
    emailCaptureRepoMock.save.mockImplementation(
      (entity: Record<string, unknown>) =>
        Promise.resolve({ id: 'capture-1', ...entity }),
    );
    emailServiceMock.sendCalculatorResultEmail.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstimationsService,
        EstimationEngine,
        {
          provide: getRepositoryToken(EstimationResult),
          useValue: estimationRepoMock,
        },
        {
          provide: getRepositoryToken(MaterialCatalog),
          useValue: materialsRepoMock,
        },
        { provide: getRepositoryToken(WorkType), useValue: workTypesRepoMock },
        {
          provide: getRepositoryToken(EmailCapture),
          useValue: emailCaptureRepoMock,
        },
        { provide: ProjectsService, useValue: projectsServiceMock },
        { provide: EmailService, useValue: emailServiceMock },
        { provide: AnalyticsService, useValue: analyticsServiceMock },
      ],
    }).compile();

    service = module.get(EstimationsService);
  });

  it('throws BadRequestException when consent is false, without persisting or emailing anything', async () => {
    await expect(
      service.emailEstimate(makeEmailDto({ consent: false })),
    ).rejects.toThrow(BadRequestException);

    expect(emailCaptureRepoMock.save).not.toHaveBeenCalled();
    expect(emailServiceMock.sendCalculatorResultEmail).not.toHaveBeenCalled();
  });

  it('propagates NotFoundException for an unknown work type without persisting', async () => {
    workTypesRepoMock.findOne.mockResolvedValue(null);

    await expect(service.emailEstimate(makeEmailDto())).rejects.toThrow(
      NotFoundException,
    );
    expect(emailCaptureRepoMock.save).not.toHaveBeenCalled();
  });

  it('persists the server-recomputed items (never the client-supplied result) and sends the email', async () => {
    const result = await service.emailEstimate(makeEmailDto());

    expect(emailCaptureRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'visiteur@example.fr',
        work_type_code: 'wall_painting',
        skill_level: 'intermediate',
        consent: true,
      }),
    );
    const [createArg] = emailCaptureRepoMock.create.mock.calls[0] as [
      { estimate_snapshot: Array<{ material_name: string }> },
    ];
    expect(createArg.estimate_snapshot[0].material_name).toBe(
      'Peinture acrylique mate',
    );
    expect(emailServiceMock.sendCalculatorResultEmail).toHaveBeenCalledWith(
      'visiteur@example.fr',
      expect.objectContaining({ workTypeLabel: 'Peinture murale' }),
    );
    expect(emailCaptureRepoMock.save).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ sent: true });
  });

  it('still persists the capture and returns sent:false when the Brevo call fails', async () => {
    emailServiceMock.sendCalculatorResultEmail.mockRejectedValue(
      new Error('Brevo down'),
    );

    const result = await service.emailEstimate(makeEmailDto());

    expect(result).toEqual({ sent: false });
    expect(emailCaptureRepoMock.save).toHaveBeenCalledTimes(1);
  });

  it('tracks an email_capture analytics event with the outcome', async () => {
    await service.emailEstimate(makeEmailDto());

    expect(analyticsServiceMock.track).toHaveBeenCalledWith(
      'email_capture',
      null,
      expect.objectContaining({ work_type_code: 'wall_painting', sent: true }),
    );
  });
});
