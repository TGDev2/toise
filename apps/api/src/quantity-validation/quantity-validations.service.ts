import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { UserScope } from '../users/user-context.service';
import type { ShoppingListMaterialItem } from '../shopping-lists/entities/shopping-list.entity';
import { ShoppingListsService } from '../shopping-lists/shopping-lists.service';
import {
  QuantityValidation,
  ValidatedQuantityLine,
} from './entities/quantity-validation.entity';
import { fingerprintShoppingList } from './quantity-fingerprint';
import { ValidateQuantitiesDto } from './dto/validate-quantities.dto';

/** Ce que l'écran de devis a besoin de savoir avant de proposer le geste. */
export interface QuantityValidationState {
  fingerprint: string;
  lines: ValidatedQuantityLine[];
  validated_at: string | null;
  validated_by: string | null;
}

@Injectable()
export class QuantityValidationsService {
  constructor(
    @InjectRepository(QuantityValidation)
    private readonly repo: Repository<QuantityValidation>,
    private readonly shoppingListsService: ShoppingListsService,
  ) {}

  /**
   * Les quantités à valider, et l'état de la validation qui leur correspond.
   *
   * L'empreinte vient du serveur et jamais du client : c'est elle qui sera
   * comparée à l'émission, et deux calculs concurrents de la même grandeur
   * finissent toujours par diverger sur un arrondi (leçon 15).
   */
  async getState(
    projectId: string,
    userId: string,
  ): Promise<QuantityValidationState> {
    const { shoppingList } = await this.shoppingListsService.getOrGenerate(
      projectId,
      userId,
    );
    const { lines, fingerprint } = fingerprintShoppingList(
      shoppingList.items_json.material_items,
    );

    const existing = await this.findMatching(projectId, fingerprint);
    return {
      fingerprint,
      lines,
      validated_at: existing ? existing.validated_at.toISOString() : null,
      validated_by: existing ? existing.user_email : null,
    };
  }

  async validate(
    projectId: string,
    scope: UserScope,
    dto: ValidateQuantitiesDto,
  ): Promise<QuantityValidationState> {
    const state = await this.getState(projectId, scope.userId);

    if (state.lines.length === 0) {
      throw new BadRequestException({
        message:
          'Aucune quantité à valider : renseignez au moins un prix pour chiffrer le devis.',
        error: 'NOTHING_TO_VALIDATE',
      });
    }

    if (dto.fingerprint !== state.fingerprint) {
      throw new ConflictException({
        message:
          'Les quantités ont changé depuis leur affichage. Relisez-les avant de valider.',
        error: 'QUANTITIES_CHANGED',
        fingerprint: state.fingerprint,
      });
    }

    // Idempotent : deux taps sur le même bouton ne produisent pas deux actes.
    // Une correction, elle, change l'empreinte et appelle donc une ligne neuve.
    const existing = await this.findMatching(projectId, state.fingerprint);
    if (existing) {
      return {
        ...state,
        validated_at: existing.validated_at.toISOString(),
        validated_by: existing.user_email,
      };
    }

    const entity = this.repo.create({
      project_id: projectId,
      user_id: scope.userId,
      user_email: scope.user.email,
      quantities_fingerprint: state.fingerprint,
      quantities_json: state.lines,
      line_count: state.lines.length,
    });
    const saved = await this.repo.save(entity);

    return {
      ...state,
      validated_at: saved.validated_at.toISOString(),
      validated_by: saved.user_email,
    };
  }

  /**
   * La garde d'émission. Appelée par `QuotesService` avec les lignes qu'il
   * s'apprête à figer — pas avec un identifiant : ce qui doit correspondre,
   * c'est ce qui part sur le devis, pas ce que la base contenait au moment du
   * geste.
   *
   * Un devis sans aucune ligne matériau chiffrée ne porte aucune quantité
   * calculée : il n'y a rien à valider et rien à prouver. La garde ne s'y
   * applique donc pas, et un devis de main-d'œuvre seule reste émissible.
   */
  async assertValidated(
    projectId: string,
    materialItems: ShoppingListMaterialItem[],
  ): Promise<void> {
    const { lines, fingerprint } = fingerprintShoppingList(materialItems);
    if (lines.length === 0) return;

    const existing = await this.findMatching(projectId, fingerprint);
    if (existing) return;

    throw new ConflictException({
      message:
        'Les quantités doivent être validées avant de créer le devis. Si vous les avez corrigées depuis, validez-les à nouveau.',
      error: 'QUANTITIES_NOT_VALIDATED',
      fingerprint,
    });
  }

  private findMatching(
    projectId: string,
    fingerprint: string,
  ): Promise<QuantityValidation | null> {
    return this.repo.findOne({
      where: { project_id: projectId, quantities_fingerprint: fingerprint },
      order: { validated_at: 'DESC' },
    });
  }
}
