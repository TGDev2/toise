import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type {
  SupplierAdapter,
  SupplierLookupItem,
  SupplierPriceResult,
} from '../supplier-adapter.interface';
import { SupplierMaterialMatch } from '../../entities/supplier-material-match.entity';
import { proratePrice } from '../../matching/pack-size';
import { ManoManoFeedSyncService } from './manomano-feed-sync.service';
import {
  MANOMANO_SUPPLIER_KEY,
  MANOMANO_SUPPLIER_NAME,
} from './manomano.constants';

/**
 * Premier adaptateur fournisseur réel (BACKLOG BUY-1).
 *
 * ManoMano ne publie pas d'API de prix : le programme d'affiliation expose un
 * flux produits, et `docs/PRODUCT_STRATEGY.md:174` proscrit explicitement le
 * scraping. La recherche de prix n'est donc pas un appel réseau par matériau
 * mais une lecture de l'index rapproché en amont — une requête indexée pour
 * toute la liste d'achats.
 *
 * L'adaptateur ne renvoie jamais de prix approximatif : à défaut de
 * rapprochement, ou si le conditionnement marchand est trop éloigné de celui
 * du devis, il répond `not_found`.
 */
@Injectable()
export class ManoManoAdapter implements SupplierAdapter {
  readonly supplierKey = MANOMANO_SUPPLIER_KEY;
  readonly supplierName = MANOMANO_SUPPLIER_NAME;

  private readonly logger = new Logger(ManoManoAdapter.name);

  constructor(
    @InjectRepository(SupplierMaterialMatch)
    private readonly matchRepo: Repository<SupplierMaterialMatch>,
    private readonly syncService: ManoManoFeedSyncService,
  ) {}

  async lookupPrices(
    items: SupplierLookupItem[],
    _postalCode?: string,
  ): Promise<Map<string, SupplierPriceResult>> {
    const results = new Map<string, SupplierPriceResult>();
    if (items.length === 0) {
      return results;
    }

    // Rafraîchissement opportuniste : ne bloque pas la réponse, la requête
    // courante est servie avec l'index tel qu'il est.
    this.syncService.syncIfStale();

    const matches = await this.matchRepo.findBy({
      supplier_key: MANOMANO_SUPPLIER_KEY,
      material_id: In(items.map((item) => item.material_id)),
    });
    const byMaterial = new Map(
      matches.map((match) => [match.material_id, match]),
    );

    const fetchedAt = new Date().toISOString();
    for (const item of items) {
      const match = byMaterial.get(item.material_id);
      results.set(
        item.material_id,
        match
          ? this.toPriceResult(item, match, fetchedAt)
          : notFound(item, fetchedAt),
      );
    }

    return results;
  }

  private toPriceResult(
    item: SupplierLookupItem,
    match: SupplierMaterialMatch,
    fetchedAt: string,
  ): SupplierPriceResult {
    // `numeric` revient en `string` du driver Postgres.
    const price = Number(match.price);
    const packQty = Number(match.pack_qty);

    // Le devis compte des colis (`units_needed`) au format qu'il a choisi ; le
    // marchand vend le sien. On ramène le prix réel au colis du devis, et on
    // renonce plutôt que d'extrapoler au-delà de la bande admise.
    const unitPrice = proratePrice(price, packQty, item.packaging_qty_per_unit);
    if (unitPrice === null) {
      return notFound(item, fetchedAt);
    }

    return {
      supplier_key: this.supplierKey,
      supplier_name: this.supplierName,
      // Le conditionnement marchand reste visible : c'est ce que l'acheteur
      // trouvera au bout du lien, et cela rend l'écart de format lisible.
      product_name: `${match.product_name} (${formatPack(packQty, match.pack_unit)})`,
      unit_price: unitPrice,
      currency: match.currency,
      availability: match.availability,
      product_url: match.product_url,
      fetched_at: fetchedAt,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const count = await this.matchRepo.countBy({
        supplier_key: MANOMANO_SUPPLIER_KEY,
      });
      return count > 0;
    } catch (error) {
      this.logger.warn(
        `Contrôle de santé ManoMano en échec : ${(error as Error).message}`,
      );
      return false;
    }
  }
}

function notFound(
  item: SupplierLookupItem,
  fetchedAt: string,
): SupplierPriceResult {
  return {
    supplier_key: MANOMANO_SUPPLIER_KEY,
    supplier_name: MANOMANO_SUPPLIER_NAME,
    product_name: item.material_name,
    unit_price: 0,
    currency: 'EUR',
    availability: 'not_found',
    fetched_at: fetchedAt,
  };
}

/** « 2.5 L », « 25 kg », « 1.08 m2 » — sans zéros de queue parasites. */
function formatPack(qty: number, unit: string): string {
  return `${Number(qty.toFixed(2))} ${unit}`;
}
