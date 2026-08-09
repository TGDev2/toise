import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { QuantityValidationsService } from './quantity-validations.service';
import { QuantityValidation } from './entities/quantity-validation.entity';
import { ShoppingListsService } from '../shopping-lists/shopping-lists.service';
import { fingerprintShoppingList } from './quantity-fingerprint';
import type { ShoppingListMaterialItem } from '../shopping-lists/entities/shopping-list.entity';
import type { UserScope } from '../users/user-context.service';

const PROJECT_ID = 'project-1';

function item(
  overrides: Partial<ShoppingListMaterialItem> = {},
): ShoppingListMaterialItem {
  return {
    material_id: 'mat-paint',
    work_type_code: 'wall_painting',
    work_type_label: 'Peinture murale',
    material_name: 'Peinture acrylique mate',
    material_category: 'painting',
    material_unit: 'L',
    packaging_label: 'Pot 10 L',
    packaging_qty_per_unit: 10,
    adjusted_qty: 10.5,
    original_units_needed: 2,
    units_needed: 2,
    is_manually_adjusted: false,
    real_unit_price: 42,
    ...overrides,
  };
}

const SCOPE = {
  userId: 'user-1',
  user: { id: 'user-1', email: 'artisan@chiffreo.test' },
} as UserScope;

describe('QuantityValidationsService', () => {
  let service: QuantityValidationsService;

  const repoMock = {
    findOne: jest.fn(),
    create: jest.fn((data: unknown) => data),
    save: jest.fn(),
  };
  const shoppingListsServiceMock = { getOrGenerate: jest.fn() };

  function givenShoppingList(items: ShoppingListMaterialItem[]) {
    shoppingListsServiceMock.getOrGenerate.mockResolvedValue({
      shoppingList: {
        items_json: { material_items: items, complementary_items: [] },
      },
      latestEstimationId: 'estimation-1',
    });
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    repoMock.findOne.mockResolvedValue(null);
    repoMock.create.mockImplementation((data: unknown) => data);
    repoMock.save.mockImplementation((entity: Record<string, unknown>) =>
      Promise.resolve({
        id: 'validation-1',
        validated_at: new Date('2026-08-08T12:00:00.000Z'),
        ...entity,
      }),
    );
    givenShoppingList([item()]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuantityValidationsService,
        {
          provide: getRepositoryToken(QuantityValidation),
          useValue: repoMock,
        },
        { provide: ShoppingListsService, useValue: shoppingListsServiceMock },
      ],
    }).compile();

    service = module.get(QuantityValidationsService);
  });

  describe('getState', () => {
    it('rend les quantités à valider et une empreinte serveur', async () => {
      const state = await service.getState(PROJECT_ID, 'user-1');

      expect(state.lines).toHaveLength(1);
      expect(state.fingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(state.validated_at).toBeNull();
    });

    it('rend la validation existante quand elle porte sur ces quantités-là', async () => {
      repoMock.findOne.mockResolvedValue({
        validated_at: new Date('2026-08-08T12:00:00.000Z'),
        user_email: 'artisan@chiffreo.test',
      });

      const state = await service.getState(PROJECT_ID, 'user-1');

      expect(state.validated_at).toBe('2026-08-08T12:00:00.000Z');
      expect(state.validated_by).toBe('artisan@chiffreo.test');
    });
  });

  describe('validate', () => {
    it("enregistre l'acte avec son auteur, son empreinte et l'instantané", async () => {
      const { fingerprint } = fingerprintShoppingList([item()]);

      const state = await service.validate(PROJECT_ID, SCOPE, { fingerprint });

      expect(repoMock.save).toHaveBeenCalledTimes(1);
      expect(repoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: PROJECT_ID,
          user_id: 'user-1',
          user_email: 'artisan@chiffreo.test',
          quantities_fingerprint: fingerprint,
          line_count: 1,
        }),
      );
      // L'instantané, et pas seulement l'empreinte : sans lui, une liste
      // régénérée rendrait la trace invérifiable.
      const created = repoMock.create.mock.calls[0][0] as {
        quantities_json: unknown[];
      };
      expect(created.quantities_json).toEqual([
        expect.objectContaining({ material_id: 'mat-paint', units_needed: 2 }),
      ]);
      expect(state.validated_at).toBe('2026-08-08T12:00:00.000Z');
    });

    /**
     * Le geste doit porter sur ce que l'artisan a lu. Une liste régénérée dans
     * un autre onglet suffit à séparer les deux, et la trace attesterait alors
     * d'un consentement qui n'a pas eu lieu.
     */
    it("refuse quand l'empreinte affichée ne correspond plus à la liste", async () => {
      const stale = fingerprintShoppingList([
        item({ units_needed: 99 }),
      ]).fingerprint;

      await expect(
        service.validate(PROJECT_ID, SCOPE, { fingerprint: stale }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repoMock.save).not.toHaveBeenCalled();
    });

    it('refuse de valider une liste sans aucune ligne chiffrée', async () => {
      givenShoppingList([item({ real_unit_price: null })]);
      const { fingerprint } = fingerprintShoppingList([]);

      await expect(
        service.validate(PROJECT_ID, SCOPE, { fingerprint }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repoMock.save).not.toHaveBeenCalled();
    });

    it('est idempotent : deux taps ne produisent pas deux actes', async () => {
      const { fingerprint } = fingerprintShoppingList([item()]);
      repoMock.findOne.mockResolvedValue({
        validated_at: new Date('2026-08-08T12:00:00.000Z'),
        user_email: 'artisan@chiffreo.test',
      });

      const state = await service.validate(PROJECT_ID, SCOPE, { fingerprint });

      expect(repoMock.save).not.toHaveBeenCalled();
      expect(state.validated_at).toBe('2026-08-08T12:00:00.000Z');
    });
  });

  describe('assertValidated', () => {
    it('laisse passer une liste dont les quantités ont été validées', async () => {
      repoMock.findOne.mockResolvedValue({ id: 'validation-1' });

      await expect(
        service.assertValidated(PROJECT_ID, [item()]),
      ).resolves.toBeUndefined();
    });

    it('refuse une liste sans validation correspondante', async () => {
      repoMock.findOne.mockResolvedValue(null);

      await expect(
        service.assertValidated(PROJECT_ID, [item()]),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    /**
     * C'est le cœur du mécanisme : la garde porte sur les quantités, pas sur
     * l'existence d'une validation. Une correction faite après le geste — même
     * depuis un autre écran — périme la validation sans que rien n'ait à la
     * révoquer explicitement.
     */
    it('cherche la validation par empreinte, donc une correction ultérieure la périme', async () => {
      repoMock.findOne.mockResolvedValue(null);
      const validated = fingerprintShoppingList([item()]).fingerprint;

      await expect(
        service.assertValidated(PROJECT_ID, [item({ units_needed: 3 })]),
      ).rejects.toBeInstanceOf(ConflictException);

      const calls = repoMock.findOne.mock.calls as [
        { where: { quantities_fingerprint: string } },
      ][];
      expect(calls[0][0].where.quantities_fingerprint).not.toBe(validated);
    });

    /**
     * Un devis de main-d'œuvre seule ne porte aucune quantité calculée : il n'y
     * a rien à valider et rien à prouver. Le bloquer aurait rendu impossible un
     * devis parfaitement légitime pour protéger d'un risque inexistant.
     */
    it("n'exige rien d'un devis sans ligne matériau chiffrée", async () => {
      await expect(
        service.assertValidated(PROJECT_ID, [item({ real_unit_price: null })]),
      ).resolves.toBeUndefined();
      expect(repoMock.findOne).not.toHaveBeenCalled();
    });
  });
});
