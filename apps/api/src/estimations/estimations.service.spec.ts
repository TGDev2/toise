import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  EstimationsService,
  GUEST_ESTIMATION_LIMIT,
} from './estimations.service';
import { EstimationEngine } from './estimation-engine';
import { EstimationResult } from './entities/estimation-result.entity';
import { EmailCapture } from './entities/email-capture.entity';
import {
  MaterialCatalog,
  MaterialCategory,
} from '../materials/entities/material-catalog.entity';
import { WorkTypeMaterial } from '../materials/entities/work-type-material.entity';
import { WorkType } from '../projects/entities/work-type.entity';
import { ProjectsService } from '../projects/projects.service';
import { EmailService } from '../email/email.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';
import { SkillLevel } from '../projects/entities/project-work-item.entity';
import { ProjectStatus } from '../projects/entities/project.entity';
import { PublicEstimateRequestDto } from './dto/public-estimate-request.dto';
import { PublicEstimateEmailDto } from './dto/public-estimate-email.dto';

const mockWorkType: WorkType = {
  id: 'wt-wall-painting',
  code: 'wall_painting',
  label_fr: 'Peinture murale',
  category: 'painting',
  surface_target: 'wall',
  quantity_basis: 'room_surface',
  frame_spec: null,
  waste_factor_base: 1.1,
  contextual_questions: [],
  display_order: 1,
  labor_minutes_per_m2: null,
  created_at: new Date('2026-03-27T00:00:00.000Z'),
  updated_at: new Date('2026-03-27T00:00:00.000Z'),
};

const mockMaterial = {
  id: 'mat-paint',
  name: 'Peinture acrylique mate',
  category: MaterialCategory.PAINTING,
  unit: 'L',
  yield_per_unit: 10,
  // E1-4 : une peinture suit le nombre de couches, l'attribut est porté par le
  // catalogue et propagé par loadMaterialInputs.
  applies_coats: true,
  is_active: true,
  is_eco: false,
  // E1-7 : les trois niveaux, parce que le moteur ne comble plus les trous.
  // Un catalogue partiel ne rend plus 10 % en silence, il lève — un fixture
  // partiel doit donc être complété plutôt que subi.
  waste_factors: [
    { pose_type: 'standard', skill_level: 'beginner', factor_percent: 15 },
    { pose_type: 'standard', skill_level: 'intermediate', factor_percent: 5 },
    { pose_type: 'standard', skill_level: 'expert', factor_percent: 2 },
  ],
  packagings: [
    { label: 'Pot 10 L', quantity_per_unit: 10, unit: 'L' },
    { label: 'Pot 2,5 L', quantity_per_unit: 2.5, unit: 'L' },
  ],
} as unknown as MaterialCatalog;

// PLAT-3 : ne doit jamais être retourné par loadMaterialInputs — cf. test
// dédié « excludes eco-alternative materials ».
const mockEcoMaterial = {
  ...mockMaterial,
  id: 'mat-paint-eco',
  name: 'Peinture acrylique mate sans COV',
  is_eco: true,
} as unknown as MaterialCatalog;

const estimationRepoMock = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
};

const workTypeMaterialsRepoMock = {
  find: jest.fn().mockResolvedValue([{ material: mockMaterial }]),
};

const workTypesRepoMock = {
  findOne: jest.fn().mockResolvedValue(mockWorkType),
};

const projectsServiceMock = {
  findOneForUser: jest.fn(),
  getRooms: jest.fn(),
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
    workTypeMaterialsRepoMock.find.mockResolvedValue([
      { material: mockMaterial },
    ]);
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
          provide: getRepositoryToken(WorkTypeMaterial),
          useValue: workTypeMaterialsRepoMock,
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

  it('tracks public_calculation_completed (BACKLOG_V1 revenue funnel)', async () => {
    await service.estimatePublic(makeDto());

    expect(analyticsServiceMock.track).toHaveBeenCalledWith(
      AnalyticsEventName.PUBLIC_CALCULATION_COMPLETED,
      null,
      { work_type_code: 'wall_painting', skill_level: 'intermediate' },
    );
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

  it('deducts surface exclusions from the wall surface (GTM-9)', async () => {
    // Le formulaire public rend `ExclusionsSection` et déduit déjà l'aire dans
    // son aperçu en direct. Si le chemin public jette les exclusions, la page
    // affiche une surface et en chiffre une autre, plus grande.
    const withExclusion = await service.estimatePublic(
      makeDto({
        exclusions: [{ surface_target: 'wall', type: 'credence', area_m2: 3 }],
      } as Partial<PublicEstimateRequestDto>),
    );
    const withoutExclusion = await service.estimatePublic(makeDto());

    expect(withExclusion.items[0].surface_m2).toBeCloseTo(
      withoutExclusion.items[0].surface_m2 - 3,
      5,
    );
  });

  it('ignores an exclusion that targets another surface (GTM-9)', async () => {
    // `wall_painting` cible le mur : une exclusion de sol ne doit rien retirer.
    const withFloorExclusion = await service.estimatePublic(
      makeDto({
        exclusions: [{ surface_target: 'floor', type: 'other', area_m2: 3 }],
      } as Partial<PublicEstimateRequestDto>),
    );
    const withoutExclusion = await service.estimatePublic(makeDto());

    expect(withFloorExclusion.items[0].surface_m2).toBeCloseTo(
      withoutExclusion.items[0].surface_m2,
      5,
    );
  });

  it('excludes eco-alternative materials from the automatic estimation loop', async () => {
    // PLAT-3 : le filtre éco est appliqué par le service une fois les
    // liaisons chargées, pas délégué au `where` de `work_type_materials` — on
    // renvoie les deux matériaux pour prouver que seul le non-éco ressort.
    workTypeMaterialsRepoMock.find.mockResolvedValue([
      { material: mockMaterial },
      { material: mockEcoMaterial },
    ]);

    const result = await service.estimatePublic(makeDto());

    expect(result.items).toHaveLength(1);
    expect(result.items[0].material_id).toBe('mat-paint');
    expect(workTypeMaterialsRepoMock.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          work_type_id: mockWorkType.id,
          is_optional: false,
        }) as object,
      }) as object,
    );
  });

  it('applies the catalog waste factor, and marks it as such', async () => {
    // E4-2 : les facteurs de perte **appris** (DATA-3) se superposaient au
    // catalogue avant l'appel au moteur. Le module d'apprentissage est
    // supprimé et `learned_waste_factors` n'a jamais reçu une ligne — la
    // superposition rendait donc déjà le catalogue inchangé. Ce test fige le
    // seul comportement restant : la cellule (standard, intermediate) du
    // catalogue vaut 5 %, et c'est elle qui est appliquée.
    const result = await service.estimatePublic(makeDto());

    expect(result.items[0].waste_factor_percent).toBe(5);
    expect(result.items[0].waste_factor_source).toBe('catalog');
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
    workTypeMaterialsRepoMock.find.mockResolvedValue([
      { material: mockMaterial },
    ]);
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
          provide: getRepositoryToken(WorkTypeMaterial),
          useValue: workTypeMaterialsRepoMock,
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

  it('never tracks public_calculation_completed — email capture is a distinct surface (BACKLOG_V1)', async () => {
    await service.emailEstimate(makeEmailDto());

    expect(analyticsServiceMock.track).not.toHaveBeenCalledWith(
      AnalyticsEventName.PUBLIC_CALCULATION_COMPLETED,
      expect.anything(),
      expect.anything(),
    );
  });
});

describe('EstimationsService.estimate', () => {
  let service: EstimationsService;

  const mockWorkItem = {
    id: 'wi-1',
    work_type: mockWorkType,
    skill_level: SkillLevel.INTERMEDIATE,
    custom_params: {},
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    workTypeMaterialsRepoMock.find.mockResolvedValue([
      { material: mockMaterial },
    ]);
    projectsServiceMock.getRooms.mockResolvedValue([
      {
        id: 'room-1',
        name: 'Salon',
        dimensions: {
          length_cm: 400,
          width_cm: 300,
          height_cm: 250,
          segments_json: null,
        },
        openings: [{ width_cm: 90, height_cm: 210, count: 1 }],
        workItems: [mockWorkItem],
      },
    ]);
    projectsServiceMock.updateStatus.mockResolvedValue(undefined);
    estimationRepoMock.create.mockImplementation(
      (data: Record<string, unknown>) => data,
    );
    estimationRepoMock.save.mockImplementation(
      (entity: Record<string, unknown>) =>
        Promise.resolve({ id: 'estimation-1', ...entity }),
    );
    estimationRepoMock.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstimationsService,
        EstimationEngine,
        {
          provide: getRepositoryToken(EstimationResult),
          useValue: estimationRepoMock,
        },
        {
          provide: getRepositoryToken(WorkTypeMaterial),
          useValue: workTypeMaterialsRepoMock,
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

  it('throws BadRequestException when no room has dimensions', async () => {
    projectsServiceMock.getRooms.mockResolvedValue([
      {
        id: 'room-1',
        name: 'Salon',
        dimensions: null,
        openings: [],
        workItems: [],
      },
    ]);

    await expect(service.estimate('project-1', 'user-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException when no estimable room has work items', async () => {
    projectsServiceMock.getRooms.mockResolvedValue([
      {
        id: 'room-1',
        name: 'Salon',
        dimensions: {
          length_cm: 400,
          width_cm: 300,
          height_cm: 250,
          segments_json: null,
        },
        openings: [],
        workItems: [],
      },
    ]);

    await expect(service.estimate('project-1', 'user-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('persists the estimation and marks the project as ESTIMATED', async () => {
    const result = await service.estimate('project-1', 'user-1');

    expect(result.project_id).toBe('project-1');
    expect(projectsServiceMock.updateStatus).toHaveBeenCalledWith(
      'project-1',
      ProjectStatus.ESTIMATED,
    );
  });

  it('tracks an estimate_created analytics event', async () => {
    const result = await service.estimate('project-1', 'user-1');

    expect(analyticsServiceMock.track).toHaveBeenCalledWith(
      AnalyticsEventName.ESTIMATE_CREATED,
      'user-1',
      { project_id: 'project-1', total_items: result.total_items },
    );
  });

  // ENG-3: surfaces à exclure (déduction manuelle simple)
  it('deducts room exclusions from the net surface', async () => {
    const baseline = await service.estimate('project-1', 'user-1');

    projectsServiceMock.getRooms.mockResolvedValue([
      {
        id: 'room-1',
        name: 'Salon',
        dimensions: {
          length_cm: 400,
          width_cm: 300,
          height_cm: 250,
          segments_json: null,
          exclusions_json: [
            { surface_target: 'wall', type: 'credence', area_m2: 2 },
          ],
        },
        openings: [{ width_cm: 90, height_cm: 210, count: 1 }],
        workItems: [mockWorkItem],
      },
    ]);

    const withExclusion = await service.estimate('project-1', 'user-1');

    expect(withExclusion.items_json[0].surface_m2).toBeLessThan(
      baseline.items_json[0].surface_m2,
    );
    expect(withExclusion.items_json[0].excluded_surface_m2).toBe(2);
  });

  // CV-5 : l'incertitude persistée sur room_dimensions traverse le service
  // jusqu'à la ligne d'estimation.
  it('forwards the room dimensions uncertainty into a surface/quantity range', async () => {
    projectsServiceMock.getRooms.mockResolvedValue([
      {
        id: 'room-1',
        name: 'Salon',
        dimensions: {
          length_cm: 400,
          width_cm: 300,
          height_cm: 250,
          segments_json: null,
          length_cm_uncertainty: 10,
          width_cm_uncertainty: 5,
          height_cm_uncertainty: null,
        },
        openings: [{ width_cm: 90, height_cm: 210, count: 1 }],
        workItems: [mockWorkItem],
      },
    ]);

    const result = await service.estimate('project-1', 'user-1');

    expect(result.items_json[0].surface_m2_low).toBeDefined();
    expect(result.items_json[0].surface_m2_high).toBeDefined();
    expect(result.items_json[0].surface_m2_low!).toBeLessThan(
      result.items_json[0].surface_m2,
    );
  });

  /**
   * Plafond d'estimations persistées pour un compte invité (E2-1). Chaque appel
   * écrit une ligne sans dédoublonnage ni purge : c'est la seule écriture non
   * bornée qu'un compte anonyme puisse déclencher. Le `@Throttle` de la route
   * borne le débit par IP, ce plafond-ci le volume par compte.
   */
  describe('plafond invité', () => {
    it('laisse le parcours nominal se dérouler', async () => {
      estimationRepoMock.count.mockResolvedValue(GUEST_ESTIMATION_LIMIT - 1);

      await expect(
        service.estimate('project-1', 'user-1', undefined, true),
      ).resolves.toBeDefined();
    });

    it('refuse au-delà du plafond, et seulement pour un invité', async () => {
      estimationRepoMock.count.mockResolvedValue(GUEST_ESTIMATION_LIMIT);

      await expect(
        service.estimate('project-1', 'user-1', undefined, true),
      ).rejects.toThrow(ForbiddenException);

      // Même projet, même volume déjà persisté : un compte inscrit passe.
      await expect(
        service.estimate('project-1', 'user-1', undefined, false),
      ).resolves.toBeDefined();
    });

    /**
     * Refuser après avoir dépensé le CPU qu'on prétend économiser n'aurait
     * aucun sens : le plafond se vérifie avant toute lecture de pièce.
     */
    it('refuse avant de calculer quoi que ce soit', async () => {
      estimationRepoMock.count.mockResolvedValue(GUEST_ESTIMATION_LIMIT);

      await expect(
        service.estimate('project-1', 'user-1', undefined, true),
      ).rejects.toThrow(ForbiddenException);

      expect(projectsServiceMock.getRooms).not.toHaveBeenCalled();
      expect(estimationRepoMock.save).not.toHaveBeenCalled();
    });

    it('annonce le code lu par le front', async () => {
      estimationRepoMock.count.mockResolvedValue(GUEST_ESTIMATION_LIMIT);

      let thrown: unknown;
      try {
        await service.estimate('project-1', 'user-1', undefined, true);
      } catch (error) {
        thrown = error;
      }

      expect((thrown as ForbiddenException).getResponse()).toMatchObject({
        error: 'GUEST_ESTIMATE_LIMIT_REACHED',
        limit: GUEST_ESTIMATION_LIMIT,
      });
    });

    /**
     * Par défaut, personne n'est invité : un appelant qui oublie le drapeau ne
     * doit pas se voir opposer un plafond qui ne le concerne pas.
     */
    it("ne s'applique pas quand l'appelant ne dit rien", async () => {
      estimationRepoMock.count.mockResolvedValue(GUEST_ESTIMATION_LIMIT * 10);

      await expect(
        service.estimate('project-1', 'user-1'),
      ).resolves.toBeDefined();
      expect(estimationRepoMock.count).not.toHaveBeenCalled();
    });
  });
});
