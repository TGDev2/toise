import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { OrganizationRole } from '../organizations/entities/organization-membership.entity';
import type { OrgScope } from '../organizations/org-context.service';
import { ApiKey } from './entities/api-key.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

/** Préfixe du secret : identifie le type de credential au premier coup d'œil. */
export const API_KEY_PREFIX = 'chf_';

const ROTATION_GRACE_HOURS = 24;
const MAX_ACTIVE_KEYS_PER_ORG = 10;
const LAST_USED_REFRESH_MINUTES = 5;

/** Projection publique d'une clé : ne contient **jamais** d'empreinte. */
export interface ApiKeyView {
  id: string;
  name: string;
  key_prefix: string;
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
  rotation_grace_until: Date | null;
}

export interface CreatedApiKey {
  /** Secret en clair, rendu **une seule fois** — jamais relisible ensuite. */
  secret: string;
  key: ApiKeyView;
}

/**
 * Cycle de vie des clés d'API (BACKLOG PLAT-5).
 *
 * Deux invariants tiennent tout le reste :
 *
 * - **toute recherche est scopée à l'organisation de l'appelant.** Un `id` seul
 *   ne suffit jamais : sans le filtre `organization_id`, n'importe quel
 *   administrateur d'une organisation Premium pourrait faire tourner ou révoquer
 *   la clé d'un autre client en devinant un UUID ;
 * - **le secret ne quitte le serveur qu'à la création et à la rotation.** Seul
 *   son SHA-256 est persisté ; il n'est ni journalisé, ni relisible, ni
 *   récupérable.
 */
@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(
    @InjectRepository(ApiKey)
    private readonly keysRepo: Repository<ApiKey>,
  ) {}

  async list(scope: OrgScope): Promise<ApiKeyView[]> {
    this.assertCanManageKeys(scope);
    const keys = await this.keysRepo.find({
      where: { organization_id: scope.organizationId },
      order: { created_at: 'DESC' },
    });
    return keys.map((k) => this.toView(k));
  }

  async create(scope: OrgScope, dto: CreateApiKeyDto): Promise<CreatedApiKey> {
    this.assertCanManageKeys(scope);

    const activeCount = await this.keysRepo.count({
      where: { organization_id: scope.organizationId, revoked_at: IsNull() },
    });
    if (activeCount >= MAX_ACTIVE_KEYS_PER_ORG) {
      throw new ConflictException({
        message: `Limite de ${MAX_ACTIVE_KEYS_PER_ORG} clés actives atteinte. Révoquez une clé existante.`,
        error: 'API_KEY_LIMIT_REACHED',
        limit: MAX_ACTIVE_KEYS_PER_ORG,
      });
    }

    const secret = this.generateSecret();
    const saved = await this.keysRepo.save(
      this.keysRepo.create({
        organization_id: scope.organizationId,
        name: dto.name.trim(),
        key_prefix: this.prefixOf(secret),
        key_hash: this.hashSecret(secret),
        created_by_user_id: scope.userId,
      }),
    );

    this.logger.log(
      `Clé d'API ${saved.id} créée pour l'organisation ${scope.organizationId}`,
    );
    return { secret, key: this.toView(saved) };
  }

  /**
   * Rotation **en place** : l'ancienne empreinte reste acceptée pendant la
   * fenêtre de grâce, ce qui permet de redéployer sans coupure, et l'`id` de la
   * clé ne bouge pas — son historique et les références qui la désignent
   * survivent.
   *
   * Une seconde rotation pendant la grâce est refusée : elle écraserait
   * silencieusement l'empreinte précédente et tuerait, sans aucun signal, une
   * clé encore déployée chez l'intégrateur.
   */
  async rotate(scope: OrgScope, keyId: string): Promise<CreatedApiKey> {
    this.assertCanManageKeys(scope);
    const key = await this.findManageable(scope, keyId);

    if (
      key.previous_key_expires_at &&
      key.previous_key_expires_at.getTime() > Date.now()
    ) {
      throw new ConflictException({
        message:
          'Une rotation est déjà en cours sur cette clé : attendez la fin de la période de grâce ou révoquez-la.',
        error: 'ROTATION_IN_PROGRESS',
        previous_key_expires_at: key.previous_key_expires_at,
      });
    }

    const secret = this.generateSecret();
    const graceUntil = new Date(
      Date.now() + ROTATION_GRACE_HOURS * 60 * 60 * 1000,
    );

    key.previous_key_hash = key.key_hash;
    key.previous_key_expires_at = graceUntil;
    key.key_hash = this.hashSecret(secret);
    key.key_prefix = this.prefixOf(secret);
    const saved = await this.keysRepo.save(key);

    this.logger.log(
      `Clé d'API ${saved.id} rotée, ancienne empreinte valide jusqu'au ${graceUntil.toISOString()}`,
    );
    return { secret, key: this.toView(saved) };
  }

  /**
   * Révocation immédiate, sans grâce : c'est le geste d'urgence après une fuite.
   * L'empreinte précédente est effacée en même temps, sans quoi une rotation en
   * cours laisserait un second secret encore valide.
   */
  async revoke(scope: OrgScope, keyId: string): Promise<void> {
    this.assertCanManageKeys(scope);
    const key = await this.findManageable(scope, keyId);

    key.revoked_at = new Date();
    key.previous_key_hash = null;
    key.previous_key_expires_at = null;
    await this.keysRepo.save(key);

    this.logger.log(`Clé d'API ${key.id} révoquée`);
  }

  /**
   * Recherche par empreinte, pour le guard. Renvoie la ligne telle quelle —
   * révoquée ou hors grâce comprises : c'est le guard qui distingue les cas pour
   * rendre un motif de refus exploitable par l'intégrateur.
   */
  findBySecret(secret: string): Promise<ApiKey | null> {
    const hash = this.hashSecret(secret);
    return this.keysRepo.findOne({
      where: [{ key_hash: hash }, { previous_key_hash: hash }],
    });
  }

  matchesRotatedHash(key: ApiKey, secret: string): boolean {
    return key.previous_key_hash === this.hashSecret(secret);
  }

  /**
   * Horodatage de dernier usage, auto-limité **en SQL** : une écriture par
   * requête doublerait le coût d'un appel, et un cache en mémoire divergerait
   * entre instances. Appelé en fire-and-forget, donc toute erreur doit être
   * absorbée ici — une promesse rejetée non gérée ferait tomber le process.
   */
  touchLastUsed(keyId: string): void {
    void this.keysRepo
      .query(
        `
        UPDATE "api_keys" SET "last_used_at" = now()
        WHERE "id" = $1
          AND ("last_used_at" IS NULL
               OR "last_used_at" < now() - interval '${LAST_USED_REFRESH_MINUTES} minutes')
        `,
        [keyId],
      )
      .catch((err: unknown) => {
        this.logger.warn(
          `Échec du rafraîchissement de last_used_at sur la clé ${keyId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
  }

  // ---------------------------------------------------------------------------

  private generateSecret(): string {
    return `${API_KEY_PREFIX}${randomBytes(32).toString('hex')}`;
  }

  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  /** « chf_ » + 8 caractères : 224 bits d'entropie restent inentamés. */
  private prefixOf(secret: string): string {
    return secret.slice(0, API_KEY_PREFIX.length + 8);
  }

  private toView(key: ApiKey): ApiKeyView {
    return {
      id: key.id,
      name: key.name,
      key_prefix: key.key_prefix,
      created_at: key.created_at,
      last_used_at: key.last_used_at,
      revoked_at: key.revoked_at,
      rotation_grace_until: key.previous_key_expires_at,
    };
  }

  /**
   * Le filtre `organization_id` est la barrière anti-IDOR : sans lui, un `id`
   * deviné suffirait à agir sur la clé d'un autre client. Le filtre
   * `revoked_at IS NULL` empêche de ressusciter une clé révoquée par rotation.
   */
  private async findManageable(
    scope: OrgScope,
    keyId: string,
  ): Promise<ApiKey> {
    const key = await this.keysRepo.findOne({
      where: {
        id: keyId,
        organization_id: scope.organizationId,
        revoked_at: IsNull(),
      },
    });
    if (!key) {
      throw new NotFoundException('Clé introuvable');
    }
    return key;
  }

  /**
   * Créer une clé, c'est créer un credential qui porte toute la portée de
   * l'organisation : même exigence que la gestion des membres (PLAT-4).
   */
  private assertCanManageKeys(scope: OrgScope): void {
    if (
      scope.role !== OrganizationRole.OWNER &&
      scope.role !== OrganizationRole.ADMIN
    ) {
      throw new ForbiddenException(
        "Seuls le propriétaire et les administrateurs gèrent les clés d'API",
      );
    }
  }
}
