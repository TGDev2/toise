import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QuotesService } from './quotes.service';
import { Quote, QuoteStatus } from './entities/quote.entity';
import {
  EstimationResult,
  type EstimationLineItem,
} from '../estimations/entities/estimation-result.entity';
import { ShoppingListsService } from '../shopping-lists/shopping-lists.service';
import { ProjectsService } from '../projects/projects.service';
import { ClientsService } from '../clients/clients.service';
import { CompanyProfilesService } from '../company-profiles/company-profiles.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';

const ORG_ID = 'org-1';
const USER_ID = 'user-1';
const PROJECT_ID = 'project-1';
const ESTIMATION_ID = 'estimation-1';

/**
 * `quotes.service.ts` n'avait aucun test unitaire avant E2-3 : la formule de
 * totaux du devis n'était couverte que par `quote-pdf.service.spec.ts` (rendu)
 * et `invoices.service.spec.ts` (conversion). Ce fichier couvre l'arithmétique
 * elle-même.
 */

function makeEstimationLine(
  overrides: Partial<EstimationLineItem> = {},
): EstimationLineItem {
  return {
    work_item_id: 'wi-1',
    work_type_code: 'wall_painting',
    work_type_label: 'Peinture murale',
    material_id: 'mat-1',
    material_name: 'Peinture acrylique',
    material_unit: 'L',
    gross_surface_m2: 25,
    surface_m2: 25,
    theoretical_qty: 5,
    waste_factor_percent: 10,
    waste_factor_source: 'catalog',
    adjusted_qty: 5.5,
    packaging_label: 'Pot de 10 L',
    packaging_qty_per_unit: 10,
    units_needed: 1,
    pose_type: 'roller',
    room_id: 'room-1',
    room_name: 'Salon',
    ...overrides,
  };
}

function makeEstimation(
  overrides: Partial<EstimationResult> = {},
): EstimationResult {
  return {
    id: ESTIMATION_ID,
    project_id: PROJECT_ID,
    skill_level: 'intermediate',
    items_json: [makeEstimationLine()],
    aggregated_json: null,
    total_items: 1,
    created_at: new Date('2026-08-01T08:00:00.000Z'),
    ...overrides,
  } as EstimationResult;
}

function makeWorkType(code: string, minutesPerM2: number | null) {
  return {
    id: `wt-${code}`,
    code,
    label_fr: code,
    category: 'painting',
    surface_target: 'wall',
    waste_factor_base: 1.1,
    contextual_questions: [],
    display_order: 1,
    labor_minutes_per_m2: minutesPerM2,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function makeCompanyProfile(defaultLaborHourlyRate: number | null) {
  return {
    id: 'profile-1',
    organization_id: ORG_ID,
    default_labor_hourly_rate: defaultLaborHourlyRate,
  };
}

function makeShoppingList(realUnitPrice: number | null = 50) {
  return {
    shoppingList: {
      items_json: {
        material_items: [
          {
            material_name: 'Peinture acrylique',
            material_category: 'peinture',
            work_type_label: 'Peinture murale',
            packaging_label: 'Pot de 10 L',
            units_needed: 1,
            real_unit_price: realUnitPrice,
          },
        ],
        complementary_items: [],
      },
    },
  };
}

describe('QuotesService', () => {
  let service: QuotesService;
  let managerMock: { query: jest.Mock; create: jest.Mock; save: jest.Mock };

  const repoMock = {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    save: jest.fn((entity: unknown) => Promise.resolve(entity)),
  };
  const estimationRepoMock = { findOne: jest.fn() };
  const shoppingListsServiceMock = { getOrGenerate: jest.fn() };
  const projectsServiceMock = {
    findOneForOrg: jest.fn(),
    getWorkTypes: jest.fn(),
  };
  const clientsServiceMock = { findOneForOrg: jest.fn() };
  const companyProfilesServiceMock = { findByOrganizationId: jest.fn() };
  const analyticsServiceMock = { track: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    managerMock = {
      query: jest.fn().mockResolvedValue([{ last_number: 1 }]),
      create: jest.fn((_entity: unknown, data: unknown) => data),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    };
    const dataSourceMock = {
      transaction: jest.fn((cb: (m: typeof managerMock) => unknown) =>
        cb(managerMock),
      ),
    };

    projectsServiceMock.findOneForOrg.mockResolvedValue({ id: PROJECT_ID });
    projectsServiceMock.getWorkTypes.mockResolvedValue([
      makeWorkType('wall_painting', 12),
      makeWorkType('ceiling_painting', 15),
    ]);
    estimationRepoMock.findOne.mockResolvedValue(makeEstimation());
    shoppingListsServiceMock.getOrGenerate.mockResolvedValue(
      makeShoppingList(),
    );
    companyProfilesServiceMock.findByOrganizationId.mockResolvedValue(
      makeCompanyProfile(45),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotesService,
        { provide: getRepositoryToken(Quote), useValue: repoMock },
        {
          provide: getRepositoryToken(EstimationResult),
          useValue: estimationRepoMock,
        },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: ShoppingListsService, useValue: shoppingListsServiceMock },
        { provide: ProjectsService, useValue: projectsServiceMock },
        { provide: ClientsService, useValue: clientsServiceMock },
        {
          provide: CompanyProfilesService,
          useValue: companyProfilesServiceMock,
        },
        { provide: AnalyticsService, useValue: analyticsServiceMock },
      ],
    }).compile();

    service = module.get(QuotesService);
  });

  function baseDto(overrides: Partial<CreateQuoteDto> = {}): CreateQuoteDto {
    return {
      project_id: PROJECT_ID,
      estimation_id: ESTIMATION_ID,
      material_margin_percent: 0,
      ...overrides,
    } as CreateQuoteDto;
  }

  describe("create — devis sans main-d'oeuvre explicite", () => {
    it('cree un devis a labor_items_json vide quand labor_items est absent', async () => {
      const quote = await service.create(ORG_ID, USER_ID, baseDto());

      expect(quote.labor_items_json).toEqual([]);
      expect(Number(quote.subtotal_labor_ht)).toBe(0);
      expect(Number(quote.total_ht)).toBe(50);
    });

    it('cree un devis a labor_items_json vide quand labor_items est []', async () => {
      const quote = await service.create(
        ORG_ID,
        USER_ID,
        baseDto({ labor_items: [] }),
      );

      expect(quote.labor_items_json).toEqual([]);
    });

    it('tracks quote_generated (BACKLOG_V1 revenue funnel)', async () => {
      await service.create(ORG_ID, USER_ID, baseDto());

      expect(analyticsServiceMock.track).toHaveBeenCalledWith(
        AnalyticsEventName.QUOTE_GENERATED,
        USER_ID,
        expect.objectContaining({ project_id: PROJECT_ID }),
      );
    });
  });

  describe('create — peintre, devis a deux ouvrages, deux lignes de MO', () => {
    it('Σ lignes === subtotal_labor_ht au centime, et les totaux HT/TVA/TTC sont justes', async () => {
      const dto = baseDto({
        discount_percent: 0,
        tva_rate: 20,
        labor_items: [
          {
            work_item_id: 'wi-1',
            work_type_code: 'wall_painting',
            label: 'Peinture murale',
            room_name: 'Salon',
            kind: 'hourly',
            surface_m2: 25,
            quantity: 5,
            unit_price_ht: 45,
          },
          {
            work_item_id: 'wi-2',
            work_type_code: 'ceiling_painting',
            label: 'Peinture plafond',
            room_name: 'Salon',
            kind: 'hourly',
            surface_m2: 12,
            quantity: 3,
            unit_price_ht: 45,
          },
        ],
      });

      const quote = await service.create(ORG_ID, USER_ID, dto);

      expect(quote.labor_items_json).toHaveLength(2);
      const sum = quote.labor_items_json.reduce(
        (s, l) => s + l.line_total_ht,
        0,
      );
      expect(Math.round(sum * 100) / 100).toBe(Number(quote.subtotal_labor_ht));
      expect(Number(quote.subtotal_labor_ht)).toBe(360);
      // materiaux : 1 x 50 = 50 ; MO : 225 + 135 = 360 ; HT = 410
      expect(Number(quote.total_ht)).toBe(410);
      expect(Number(quote.total_ttc)).toBe(492);
    });
  });

  describe('create — le serveur ne fait jamais confiance au client', () => {
    it('recalcule line_total_ht et ignore la valeur envoyee', async () => {
      const quote = await service.create(
        ORG_ID,
        USER_ID,
        baseDto({
          labor_items: [
            {
              label: 'Ligne suspecte',
              kind: 'hourly',
              quantity: 10,
              unit_price_ht: 20,
              // Valeur falsifiee volontairement : le DTO l'accepte (elle sert
              // aussi de repli quand le client renvoie tel quel le résultat de
              // `labor-proposal`) mais le serveur la recalcule toujours.
              line_total_ht: 1,
            },
          ],
        }),
      );

      expect(quote.labor_items_json[0].line_total_ht).toBe(200);
    });

    it('force quantity a 1 sur un forfait quel que soit ce qui est envoye', async () => {
      const quote = await service.create(
        ORG_ID,
        USER_ID,
        baseDto({
          labor_items: [
            {
              label: 'Forfait',
              kind: 'flat',
              quantity: 7,
              unit_price_ht: 500,
            },
          ],
        }),
      );

      expect(quote.labor_items_json[0].quantity).toBe(1);
      expect(quote.labor_items_json[0].line_total_ht).toBe(500);
    });
  });

  describe('update', () => {
    function makeExistingQuote(overrides: Partial<Quote> = {}): Quote {
      return {
        id: 'quote-1',
        organization_id: ORG_ID,
        project_id: PROJECT_ID,
        client_id: null,
        estimation_id: ESTIMATION_ID,
        quote_number: 'D-2026-001',
        status: QuoteStatus.DRAFT,
        labor_items_json: [
          {
            work_item_id: 'wi-1',
            work_type_code: 'wall_painting',
            label: 'Peinture murale',
            room_name: 'Salon',
            kind: 'hourly',
            surface_m2: 25,
            quantity: 5,
            unit_price_ht: 45,
            line_total_ht: 225,
          },
        ],
        material_margin_percent: 0,
        discount_percent: 0,
        items_json: [],
        subtotal_materials_ht: 0,
        subtotal_labor_ht: 225,
        total_ht: 225,
        tva_rate: 20,
        total_ttc: 270,
        ...overrides,
      } as Quote;
    }

    it('ne touche pas le tableau existant quand labor_items est absent', async () => {
      repoMock.findOne.mockResolvedValue(makeExistingQuote());

      const quote = await service.update('quote-1', ORG_ID, {
        tva_rate: 10,
      });

      expect(quote.labor_items_json).toHaveLength(1);
      expect(quote.labor_items_json[0].label).toBe('Peinture murale');
      expect(Number(quote.subtotal_labor_ht)).toBe(225);
    });

    it('remplace entierement le tableau quand labor_items est fourni', async () => {
      repoMock.findOne.mockResolvedValue(makeExistingQuote());

      const quote = await service.update('quote-1', ORG_ID, {
        labor_items: [
          {
            label: 'Peinture murale',
            kind: 'hourly',
            quantity: 8,
            unit_price_ht: 50,
          },
        ],
      });

      expect(quote.labor_items_json).toHaveLength(1);
      expect(quote.labor_items_json[0].line_total_ht).toBe(400);
      expect(Number(quote.subtotal_labor_ht)).toBe(400);
      expect(Number(quote.total_ht)).toBe(400);
    });

    it('vide le tableau quand labor_items est []', async () => {
      repoMock.findOne.mockResolvedValue(makeExistingQuote());

      const quote = await service.update('quote-1', ORG_ID, {
        labor_items: [],
      });

      expect(quote.labor_items_json).toEqual([]);
      expect(Number(quote.subtotal_labor_ht)).toBe(0);
    });

    it("refuse de modifier un devis qui n'est plus en brouillon", async () => {
      repoMock.findOne.mockResolvedValue(
        makeExistingQuote({ status: QuoteStatus.SENT }),
      );

      await expect(
        service.update('quote-1', ORG_ID, { labor_items: [] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('proposeLaborLines', () => {
    it('dedoublonne par work_item_id et ne somme jamais la surface repetee', async () => {
      estimationRepoMock.findOne.mockResolvedValue(
        makeEstimation({
          items_json: [
            makeEstimationLine({ material_id: 'mat-1', surface_m2: 25 }),
            makeEstimationLine({ material_id: 'mat-2', surface_m2: 25 }),
            makeEstimationLine({ material_id: 'mat-3', surface_m2: 25 }),
          ],
        }),
      );

      const lines = await service.proposeLaborLines(
        ORG_ID,
        PROJECT_ID,
        ESTIMATION_ID,
      );

      expect(lines).toHaveLength(1);
      expect(lines[0].surface_m2).toBe(25);
    });

    it('propose une ligne par ouvrage, temps derive de labor_minutes_per_m2 et taux du profil', async () => {
      estimationRepoMock.findOne.mockResolvedValue(
        makeEstimation({
          items_json: [
            makeEstimationLine({
              work_item_id: 'wi-1',
              work_type_code: 'wall_painting',
              surface_m2: 25,
            }),
            makeEstimationLine({
              work_item_id: 'wi-2',
              work_type_code: 'ceiling_painting',
              surface_m2: 12,
            }),
          ],
        }),
      );

      const lines = await service.proposeLaborLines(
        ORG_ID,
        PROJECT_ID,
        ESTIMATION_ID,
      );

      expect(lines).toHaveLength(2);
      // 25 m2 x 12 min/m2 / 60 = 5 h
      expect(lines[0]).toMatchObject({
        quantity: 5,
        unit_price_ht: 45,
        line_total_ht: 225,
      });
      // 12 m2 x 15 min/m2 / 60 = 3 h
      expect(lines[1]).toMatchObject({
        quantity: 3,
        unit_price_ht: 45,
        line_total_ht: 135,
      });
    });

    it('propose une ligne a 0 h pour un ouvrage sans temps unitaire connu', async () => {
      projectsServiceMock.getWorkTypes.mockResolvedValue([
        makeWorkType('wall_painting', null),
      ]);

      const lines = await service.proposeLaborLines(
        ORG_ID,
        PROJECT_ID,
        ESTIMATION_ID,
      );

      expect(lines).toHaveLength(1);
      expect(lines[0].quantity).toBe(0);
      expect(lines[0].line_total_ht).toBe(0);
    });

    it('propose un taux a 0 quand le profil ne porte pas de taux par defaut', async () => {
      companyProfilesServiceMock.findByOrganizationId.mockResolvedValue(
        makeCompanyProfile(null),
      );

      const lines = await service.proposeLaborLines(
        ORG_ID,
        PROJECT_ID,
        ESTIMATION_ID,
      );

      expect(lines[0].unit_price_ht).toBe(0);
    });

    it("propose un taux a 0 quand aucun profil entreprise n'existe", async () => {
      companyProfilesServiceMock.findByOrganizationId.mockResolvedValue(null);

      const lines = await service.proposeLaborLines(
        ORG_ID,
        PROJECT_ID,
        ESTIMATION_ID,
      );

      expect(lines[0].unit_price_ht).toBe(0);
    });

    it('ne propose pas de ligne pour un ouvrage a surface nulle', async () => {
      estimationRepoMock.findOne.mockResolvedValue(
        makeEstimation({
          items_json: [makeEstimationLine({ surface_m2: 0 })],
        }),
      );

      const lines = await service.proposeLaborLines(
        ORG_ID,
        PROJECT_ID,
        ESTIMATION_ID,
      );

      expect(lines).toEqual([]);
    });

    it("leve une exception si l'estimation n'appartient pas au projet", async () => {
      estimationRepoMock.findOne.mockResolvedValue(null);

      await expect(
        service.proposeLaborLines(ORG_ID, PROJECT_ID, ESTIMATION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
