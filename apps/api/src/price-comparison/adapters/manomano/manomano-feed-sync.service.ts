import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaterialCatalog } from '../../../materials/entities/material-catalog.entity';
import { SupplierMaterialMatch } from '../../entities/supplier-material-match.entity';
import {
  MaterialProductMatcher,
  type MaterialProductMatch,
  type MatchTarget,
} from '../../matching/material-product-matcher';
import { ManoManoFeedClient } from './manomano-feed.client';
import { MANOMANO_SUPPLIER_KEY } from './manomano.constants';

/**
 * Synchronise la table des rapprochements depuis le flux d'affiliation.
 *
 * Le dépôt n'a pas d'ordonnanceur (`@nestjs/schedule` n'est pas une
 * dépendance) et `docs/PRODUCT_STRATEGY.md:172` diffère explicitement
 * l'introduction d'une file. On suit donc le patron déjà en place pour les
 * traitements longs — lancement en tâche de fond, sans bloquer l'appelant
 * (cf. `analysis.service.ts:81-93`) : une passe au démarrage, puis une passe
 * quand l'index dépasse sa durée de fraîcheur, déclenchée par la première
 * lecture qui s'en aperçoit.
 */
@Injectable()
export class ManoManoFeedSyncService implements OnModuleInit {
  private readonly logger = new Logger(ManoManoFeedSyncService.name);
  private readonly enabled: boolean;
  private readonly feedTtlHours: number;

  /**
   * Verrou en processus. Suffisant pour l'exécution mono-instance actuelle ;
   * en multi-instance, chaque instance téléchargerait le flux de son côté et
   * écrirait le même résultat — coûteux, mais sans corruption puisque l'écriture
   * est un upsert idempotent sur `(supplier_key, material_id)`.
   */
  private syncing = false;

  constructor(
    @InjectRepository(SupplierMaterialMatch)
    private readonly matchRepo: Repository<SupplierMaterialMatch>,
    @InjectRepository(MaterialCatalog)
    private readonly materialRepo: Repository<MaterialCatalog>,
    private readonly feedClient: ManoManoFeedClient,
    private readonly configService: ConfigService,
  ) {
    this.enabled = this.configService.get<boolean>(
      'priceComparison.manoMano.enabled',
      false,
    );
    this.feedTtlHours = this.configService.get<number>(
      'priceComparison.manoMano.feedTtlHours',
      24,
    );
  }

  onModuleInit(): void {
    if (!this.enabled) {
      return;
    }
    void this.syncIfStale();
  }

  /**
   * Relance une synchronisation si l'index est périmé. Ne bloque jamais
   * l'appelant : une comparaison de prix sert l'index courant, même daté,
   * plutôt que d'attendre un téléchargement de plusieurs minutes.
   */
  syncIfStale(): void {
    if (!this.enabled || this.syncing) {
      return;
    }

    void this.isStale()
      .then((stale) => (stale ? this.sync() : undefined))
      .catch((error: Error) =>
        this.logger.error(
          `Synchronisation du flux ManoMano impossible : ${error.message}`,
        ),
      );
  }

  private async isStale(): Promise<boolean> {
    const freshest = await this.matchRepo.findOne({
      where: { supplier_key: MANOMANO_SUPPLIER_KEY },
      order: { matched_at: 'DESC' },
    });
    if (!freshest) {
      return true;
    }

    const ageMs = Date.now() - freshest.matched_at.getTime();
    return ageMs > this.feedTtlHours * 3600_000;
  }

  /**
   * Parcourt le flux, rapproche à la volée, puis remplace les rapprochements
   * non épinglés. Retourne le nombre de matériaux rapprochés.
   */
  async sync(): Promise<number> {
    if (!this.feedClient.isConfigured) {
      this.logger.warn(
        'MANOMANO_FEED_URL absent : synchronisation ignorée, aucun prix ManoMano ne sera servi.',
      );
      return 0;
    }
    if (this.syncing) {
      return 0;
    }

    this.syncing = true;
    const startedAt = Date.now();
    try {
      const targets = await this.loadTargets();
      if (targets.length === 0) {
        this.logger.warn('Catalogue matériaux vide : rien à rapprocher.');
        return 0;
      }

      const matcher = new MaterialProductMatcher(targets);
      const rows = await this.feedClient.streamProducts((product) =>
        matcher.consider(product),
      );

      const matches = matcher.results();
      const written = await this.persist(matches);

      const stats = matcher.stats();
      this.logger.log(
        `Flux ManoMano synchronisé en ${Math.round((Date.now() - startedAt) / 1000)}s : ` +
          `${rows} lignes lues, ${stats.considered} produits exploitables, ` +
          `${stats.matched}/${stats.targets} matériaux rapprochés, ${written} lignes écrites.`,
      );
      return written;
    } finally {
      this.syncing = false;
    }
  }

  private async loadTargets(): Promise<MatchTarget[]> {
    const materials = await this.materialRepo.find({
      where: { is_active: true },
      select: ['id', 'name', 'category', 'unit'],
    });

    return materials.map((material) => ({
      material_id: material.id,
      name: material.name,
      category: material.category,
      unit: material.unit,
    }));
  }

  private async persist(
    matches: readonly MaterialProductMatch[],
  ): Promise<number> {
    if (matches.length === 0) {
      return 0;
    }

    // Les lignes épinglées sont des corrections humaines : la synchronisation
    // ne les touche pas, ni pour les mettre à jour ni pour les supprimer.
    const pinned = await this.matchRepo.find({
      where: { supplier_key: MANOMANO_SUPPLIER_KEY, is_pinned: true },
      select: ['material_id'],
    });
    const pinnedIds = new Set(pinned.map((row) => row.material_id));

    const rows = matches
      .filter((match) => !pinnedIds.has(match.material_id))
      .map((match) => ({
        supplier_key: MANOMANO_SUPPLIER_KEY,
        material_id: match.material_id,
        external_id: match.product.external_id,
        product_name: match.product.title,
        product_url: match.product.product_url,
        brand: match.product.brand,
        price: match.product.price,
        currency: match.product.currency,
        pack_qty: match.pack.qty,
        pack_unit: match.pack.unit,
        availability: match.product.availability,
        match_score: match.score,
        is_pinned: false,
        matched_at: new Date(),
      }));

    if (rows.length === 0) {
      return 0;
    }

    // `orUpdate` plutôt que `orIgnore` : une synchronisation doit rafraîchir le
    // prix, pas se faire absorber par la ligne existante.
    await this.matchRepo
      .createQueryBuilder()
      .insert()
      .into(SupplierMaterialMatch)
      .values(rows)
      .orUpdate(
        [
          'external_id',
          'product_name',
          'product_url',
          'brand',
          'price',
          'currency',
          'pack_qty',
          'pack_unit',
          'availability',
          'match_score',
          'matched_at',
        ],
        ['supplier_key', 'material_id'],
      )
      .execute();

    // Un matériau qui n'est plus rapproché ne doit pas continuer à servir un
    // prix figé : on retire les lignes devenues orphelines.
    const keptIds = rows.map((row) => row.material_id);
    await this.matchRepo
      .createQueryBuilder()
      .delete()
      .from(SupplierMaterialMatch)
      .where('supplier_key = :key', { key: MANOMANO_SUPPLIER_KEY })
      .andWhere('is_pinned = false')
      .andWhere('material_id NOT IN (:...keptIds)', { keptIds })
      .execute();

    return rows.length;
  }
}
