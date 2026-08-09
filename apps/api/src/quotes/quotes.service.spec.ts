import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QuotesService } from './quotes.service';
import { Quote, QuoteStatus } from './entities/quote.entity';
import {
  EstimationResult,
  type EstimationLineItem,
} from '../estimations/entities/estimation-result.entity';
import { ShoppingListsService } from '../shopping-lists/shopping-lists.service';
import { ProjectsService } from '../projects/projects.service';
import { LaborTimeRow } from '../projects/labor-time-resolution';
import { seedLaborTimes } from '../projects/labor-times.data';
import { ClientsService } from '../clients/clients.service';
import { CompanyProfilesService } from '../company-profiles/company-profiles.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { AnalyticsService } from '../analytics/analytics.service';
import { QuantityValidationsService } from '../quantity-validation/quantity-validations.service';
import { AnalyticsEventName } from '../analytics/analytics-event-name.enum';

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
    // `standard` est la pose des ouvrages sans variante de calepinage
    // (`pose-types.ts`), pas un repli : la peinture n'en connait qu'une.
    pose_type: 'standard',
    skill_level: 'intermediate',
    room_id: 'room-1',
    room_name: 'Salon',
    ...overrides,
  };
}

/**
 * E2-2 — le registre sourcé d'E2-1, tel que `getLaborTimes()` le rend.
 *
 * Dérivé de `seedLaborTimes`, jamais de constantes recopiées : le devis doit
 * chiffrer avec les temps réellement publiés, et un fixture inventé ici
 * laisserait passer une divergence entre le registre et ce que le devis en
 * fait (leçon 32).
 */
const LABOR_TIMES: LaborTimeRow[] = seedLaborTimes.map((time) => ({
  work_type_code: time.work_type_code,
  pose_type: time.pose_type,
  skill_level: time.skill_level ?? null,
  unit_basis: time.unit_basis,
  hours_per_unit: time.hours_per_unit,
  hours_low: time.hours_low ?? null,
  hours_high: time.hours_high ?? null,
  source_org: time.source_org,
  source_document: time.source_document,
  source_url: time.source_url,
}));

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

function makeCompanyProfile(defaultLaborHourlyRate: number | null) {
  return {
    id: 'profile-1',
    user_id: USER_ID,
    default_labor_hourly_rate: defaultLaborHourlyRate,
  };
}

function makeShoppingList(realUnitPrice: number | null = 50) {
  return {
    shoppingList: {
      items_json: {
        material_items: [
          {
            // `material_id` et `work_type_code` : la ligne réelle les porte
            // toujours, et la garde de validation (E2-4) empreinte le premier.
            material_id: 'mat-paint',
            work_type_code: 'wall_painting',
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
    findOneForUser: jest.fn(),
    getLaborTimes: jest.fn(),
  };
  const clientsServiceMock = { findOneForUser: jest.fn() };
  const companyProfilesServiceMock = { findByUserId: jest.fn() };
  const analyticsServiceMock = { track: jest.fn() };
  // La garde d'émission (E2-4) est neutre par défaut : chaque test qui ne
  // porte pas sur elle décrit un chantier dont les quantités ont été validées.
  // Les tests de la garde la font échouer explicitement.
  const quantityValidationsMock = {
    assertValidated: jest.fn().mockResolvedValue(undefined),
  };

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

    quantityValidationsMock.assertValidated.mockResolvedValue(undefined);
    projectsServiceMock.findOneForUser.mockResolvedValue({ id: PROJECT_ID });
    projectsServiceMock.getLaborTimes.mockResolvedValue(LABOR_TIMES);
    estimationRepoMock.findOne.mockResolvedValue(makeEstimation());
    shoppingListsServiceMock.getOrGenerate.mockResolvedValue(
      makeShoppingList(),
    );
    companyProfilesServiceMock.findByUserId.mockResolvedValue(
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
        {
          provide: QuantityValidationsService,
          useValue: quantityValidationsMock,
        },
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
      const quote = await service.create(USER_ID, baseDto());

      expect(quote.labor_items_json).toEqual([]);
      expect(Number(quote.subtotal_labor_ht)).toBe(0);
      expect(Number(quote.total_ht)).toBe(50);
    });

    it('cree un devis a labor_items_json vide quand labor_items est []', async () => {
      const quote = await service.create(USER_ID, baseDto({ labor_items: [] }));

      expect(quote.labor_items_json).toEqual([]);
    });

    it('tracks quote_generated (BACKLOG_V1 revenue funnel)', async () => {
      await service.create(USER_ID, baseDto());

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

      const quote = await service.create(USER_ID, dto);

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

  /**
   * E2-4 — troisième ligne de défense. La garde ne reçoit pas un identifiant de
   * validation : elle reçoit les lignes que ce devis va figer. C'est la seule
   * forme qui résiste à une correction faite entre le geste et l'émission,
   * depuis n'importe quel écran.
   */
  describe('create — validation des quantités', () => {
    it("soumet à la garde les lignes de la liste d'achats, pas un identifiant", async () => {
      await service.create(USER_ID, baseDto());

      const calls = quantityValidationsMock.assertValidated.mock.calls as [
        string,
        { material_id: string }[],
      ][];
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toBe(PROJECT_ID);
      expect(calls[0][1].map((line) => line.material_id)).toEqual([
        'mat-paint',
      ]);
    });

    it("n'émet aucun devis quand la garde refuse", async () => {
      quantityValidationsMock.assertValidated.mockRejectedValueOnce(
        new ConflictException('Les quantités doivent être validées.'),
      );

      await expect(service.create(USER_ID, baseDto())).rejects.toBeInstanceOf(
        ConflictException,
      );

      // Ni numéro consommé, ni ligne insérée : le refus est en amont de la
      // transaction qui alloue le numéro de devis.
      expect(managerMock.save).not.toHaveBeenCalled();
      expect(managerMock.query).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    function makeExistingQuote(overrides: Partial<Quote> = {}): Quote {
      return {
        id: 'quote-1',
        user_id: USER_ID,
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

      const quote = await service.update('quote-1', USER_ID, {
        tva_rate: 10,
      });

      expect(quote.labor_items_json).toHaveLength(1);
      expect(quote.labor_items_json[0].label).toBe('Peinture murale');
      expect(Number(quote.subtotal_labor_ht)).toBe(225);
    });

    it('remplace entierement le tableau quand labor_items est fourni', async () => {
      repoMock.findOne.mockResolvedValue(makeExistingQuote());

      const quote = await service.update('quote-1', USER_ID, {
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

      const quote = await service.update('quote-1', USER_ID, {
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
        service.update('quote-1', USER_ID, { labor_items: [] }),
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
        USER_ID,
        PROJECT_ID,
        ESTIMATION_ID,
      );

      expect(lines).toHaveLength(1);
      expect(lines[0].surface_m2).toBe(25);
    });

    it('propose une ligne par ouvrage, heures issues du registre sourcé et taux du profil', async () => {
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
        USER_ID,
        PROJECT_ID,
        ESTIMATION_ID,
      );

      expect(lines).toHaveLength(2);
      // 25 m2 x 0,25 h/m2 (peinture murale, tous niveaux) = 6,25 h
      expect(lines[0]).toMatchObject({
        quantity: 6.25,
        unit_price_ht: 45,
        line_total_ht: 281.25,
      });
      // 12 m2 x 0,28 h/m2 (peinture plafond, tous niveaux) = 3,36 h
      expect(lines[1]).toMatchObject({
        quantity: 3.36,
        unit_price_ht: 45,
        line_total_ht: 151.2,
      });
    });

    /**
     * Le cas que l'ancien chiffrage ne pouvait pas distinguer : il lisait un
     * temps par ouvrage, sans axe de niveau, et `estimation.skill_level` ne
     * porte de toute façon que le niveau du **premier** ouvrage.
     */
    it('chiffre chaque ouvrage a son propre niveau, pas a celui du premier', async () => {
      estimationRepoMock.findOne.mockResolvedValue(
        makeEstimation({
          skill_level: 'beginner',
          items_json: [
            makeEstimationLine({
              work_item_id: 'wi-1',
              work_type_code: 'wall_painting',
              surface_m2: 25,
              skill_level: 'beginner',
            }),
            makeEstimationLine({
              work_item_id: 'wi-2',
              work_type_code: 'ceiling_painting',
              surface_m2: 12,
              skill_level: 'intermediate',
            }),
          ],
        }),
      );

      const lines = await service.proposeLaborLines(
        USER_ID,
        PROJECT_ID,
        ESTIMATION_ID,
      );

      // 25 x 0,6 h/m2 (debutant) = 15 h, contre 6,25 h pour un confirme.
      expect(lines[0].quantity).toBe(15);
      expect(lines[0].basis?.skill_level).toBe('beginner');
      // 12 x 0,28 h/m2 (tous niveaux) = 3,36 h, malgre un devis dont
      // `skill_level` vaut `beginner`.
      expect(lines[1].quantity).toBe(3.36);
      expect(lines[1].basis?.skill_level).toBeNull();
    });

    it('chiffre la pose declaree sur la ligne : une diagonale coute plus qu une pose droite', async () => {
      estimationRepoMock.findOne.mockResolvedValue(
        makeEstimation({
          items_json: [
            makeEstimationLine({
              work_item_id: 'wi-1',
              work_type_code: 'floor_tiling',
              pose_type: 'straight',
              surface_m2: 20,
            }),
            makeEstimationLine({
              work_item_id: 'wi-2',
              work_type_code: 'floor_tiling',
              pose_type: 'diagonal',
              surface_m2: 20,
            }),
          ],
        }),
      );

      const lines = await service.proposeLaborLines(
        USER_ID,
        PROJECT_ID,
        ESTIMATION_ID,
      );

      expect(lines[0].quantity).toBe(16); // 20 x 0,8
      expect(lines[1].quantity).toBe(24); // 20 x 1,2
    });

    it('retombe sur le niveau de l estimation pour une ligne calculee avant E2-2', async () => {
      const legacyLine = makeEstimationLine({ surface_m2: 25 });
      delete legacyLine.skill_level;
      estimationRepoMock.findOne.mockResolvedValue(
        makeEstimation({ skill_level: 'beginner', items_json: [legacyLine] }),
      );

      const lines = await service.proposeLaborLines(
        USER_ID,
        PROJECT_ID,
        ESTIMATION_ID,
      );

      expect(lines[0].quantity).toBe(15); // 25 x 0,6, le temps debutant
    });

    it('expose la source du temps retenu, sans jamais la persister sur le devis', async () => {
      const lines = await service.proposeLaborLines(
        USER_ID,
        PROJECT_ID,
        ESTIMATION_ID,
      );

      expect(lines[0].basis).toMatchObject({
        hours_per_unit: 0.25,
        unit_basis: 'm2',
      });
      expect(lines[0].basis?.source_url).toMatch(/^https?:\/\//);
      expect(lines[0].basis?.source_org.length).toBeGreaterThan(0);
    });

    it('propose une ligne a 0 h, sans source, pour un ouvrage absent du registre', async () => {
      estimationRepoMock.findOne.mockResolvedValue(
        makeEstimation({
          items_json: [makeEstimationLine({ work_type_code: 'roof_zinc' })],
        }),
      );

      const lines = await service.proposeLaborLines(
        USER_ID,
        PROJECT_ID,
        ESTIMATION_ID,
      );

      expect(lines).toHaveLength(1);
      expect(lines[0].quantity).toBe(0);
      expect(lines[0].line_total_ht).toBe(0);
      expect(lines[0].basis).toBeUndefined();
    });

    it('ne multiplie jamais une surface par un temps qui n est pas au m2', async () => {
      projectsServiceMock.getLaborTimes.mockResolvedValue(
        LABOR_TIMES.filter((t) => t.work_type_code !== 'wall_painting').concat({
          work_type_code: 'wall_painting',
          pose_type: 'standard',
          skill_level: null,
          unit_basis: 'ml',
          hours_per_unit: 0.4,
          hours_low: null,
          hours_high: null,
          source_org: 'org',
          source_document: 'doc',
          source_url: 'https://example.org',
        }),
      );

      const lines = await service.proposeLaborLines(
        USER_ID,
        PROJECT_ID,
        ESTIMATION_ID,
      );

      expect(lines[0].quantity).toBe(0);
      expect(lines[0].basis).toBeUndefined();
    });

    it('propose un taux a 0 quand le profil ne porte pas de taux par defaut', async () => {
      companyProfilesServiceMock.findByUserId.mockResolvedValue(
        makeCompanyProfile(null),
      );

      const lines = await service.proposeLaborLines(
        USER_ID,
        PROJECT_ID,
        ESTIMATION_ID,
      );

      expect(lines[0].unit_price_ht).toBe(0);
    });

    it("propose un taux a 0 quand aucun profil entreprise n'existe", async () => {
      companyProfilesServiceMock.findByUserId.mockResolvedValue(null);

      const lines = await service.proposeLaborLines(
        USER_ID,
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
        USER_ID,
        PROJECT_ID,
        ESTIMATION_ID,
      );

      expect(lines).toEqual([]);
    });

    it("leve une exception si l'estimation n'appartient pas au projet", async () => {
      estimationRepoMock.findOne.mockResolvedValue(null);

      await expect(
        service.proposeLaborLines(USER_ID, PROJECT_ID, ESTIMATION_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getCoveredRoomNames', () => {
    it('deduplique les noms de piece portes par les lignes de l’estimation', async () => {
      estimationRepoMock.findOne.mockResolvedValue(
        makeEstimation({
          items_json: [
            makeEstimationLine({ room_id: 'room-1', room_name: 'Salon' }),
            makeEstimationLine({
              material_id: 'mat-2',
              room_id: 'room-1',
              room_name: 'Salon',
            }),
            makeEstimationLine({
              material_id: 'mat-3',
              room_id: 'room-2',
              room_name: 'Cuisine',
            }),
          ],
        }),
      );

      const names = await service.getCoveredRoomNames(ESTIMATION_ID);

      expect(names).toEqual(['Salon', 'Cuisine']);
    });

    it('ignore les lignes anterieures a ENG-2, sans pièce associee', async () => {
      estimationRepoMock.findOne.mockResolvedValue(
        makeEstimation({
          items_json: [
            makeEstimationLine({ room_id: undefined, room_name: undefined }),
          ],
        }),
      );

      const names = await service.getCoveredRoomNames(ESTIMATION_ID);

      expect(names).toEqual([]);
    });

    it('rend un tableau vide si l’estimation a disparu', async () => {
      estimationRepoMock.findOne.mockResolvedValue(null);

      const names = await service.getCoveredRoomNames(ESTIMATION_ID);

      expect(names).toEqual([]);
    });
  });
});
