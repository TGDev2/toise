import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureGate } from './entities/feature-gate.entity';
import { SubscriptionTier } from '../users/entities/user.entity';
import { UpsertFeatureGateDto } from './dto/upsert-feature-gate.dto';

/**
 * Rangs des paliers. Tous ne sont plus vendables — `pro` a été retiré de
 * l'offre en E3-1, `contractor_standard`, `contractor_premium` et `enterprise`
 * en E3-4 — mais tous restent des valeurs que `users.subscription_tier` peut
 * porter. Retirer un rang ferait retomber ces comptes sur le repli `?? 0`,
 * c'est-à-dire sur `free`, sans que rien ne le signale.
 */
const TIER_RANK: Record<string, number> = {
  [SubscriptionTier.FREE]: 0,
  [SubscriptionTier.PRO]: 1,
  [SubscriptionTier.CONTRACTOR_ESSENTIEL]: 2,
  [SubscriptionTier.CONTRACTOR_STANDARD]: 3,
  [SubscriptionTier.CONTRACTOR_PREMIUM]: 4,
  // Enterprise domine l'échelle : un contrat annuel ouvre tout ce qu'ouvre le
  // palier Premium, plus les gates qui lui sont propres (BACKLOG PLAT-6 D2).
  [SubscriptionTier.ENTERPRISE]: 5,
};

const CACHE_TTL_MS = 60_000;

@Injectable()
export class FeatureGatesService {
  private cache: Map<string, FeatureGate> | null = null;
  private cacheExpiry = 0;

  constructor(
    @InjectRepository(FeatureGate)
    private readonly gatesRepo: Repository<FeatureGate>,
  ) {}

  async isFeatureAllowed(
    featureKey: string,
    userTier: SubscriptionTier,
  ): Promise<boolean> {
    const gate = await this.getGateConfig(featureKey);
    if (!gate) return false; // unknown feature = fail-closed
    if (!gate.is_enabled) return false;

    const userRank = TIER_RANK[userTier] ?? 0;
    // Un `min_tier` illisible doit fermer, pas entrouvrir : le repli est le
    // palier payant. Il valait `1`, le rang de `pro` — retiré de l'offre en
    // E3-1, il laissait une gate mal renseignée ouverte à un palier que plus
    // personne ne souscrit, donc fermée à tous sauf aux comptes historiques.
    const requiredRank =
      TIER_RANK[gate.min_tier] ??
      TIER_RANK[SubscriptionTier.CONTRACTOR_ESSENTIEL];
    return userRank >= requiredRank;
  }

  async getGateConfig(featureKey: string): Promise<FeatureGate | null> {
    await this.ensureCache();
    return this.cache!.get(featureKey) ?? null;
  }

  async getAllGates(): Promise<FeatureGate[]> {
    await this.ensureCache();
    return Array.from(this.cache!.values());
  }

  async upsertGate(
    featureKey: string,
    dto: UpsertFeatureGateDto,
  ): Promise<FeatureGate> {
    let gate = await this.gatesRepo.findOne({
      where: { feature_key: featureKey },
    });

    if (gate) {
      if (dto.label_fr !== undefined) gate.label_fr = dto.label_fr;
      if (dto.description_fr !== undefined)
        gate.description_fr = dto.description_fr;
      if (dto.min_tier !== undefined) gate.min_tier = dto.min_tier;
      if (dto.is_enabled !== undefined) gate.is_enabled = dto.is_enabled;
    } else {
      gate = this.gatesRepo.create({
        feature_key: featureKey,
        label_fr: dto.label_fr!,
        description_fr: dto.description_fr ?? null,
        // Une gate créée sans palier explicite doit être fermée par défaut, et
        // le seul palier payant est `contractor_essentiel` (le défaut valait
        // `pro`, supprimé de l'offre en E3-1).
        min_tier: dto.min_tier ?? SubscriptionTier.CONTRACTOR_ESSENTIEL,
        is_enabled: dto.is_enabled ?? true,
      });
    }

    const saved = await this.gatesRepo.save(gate);
    this.invalidateCache();
    return saved;
  }

  async deleteGate(featureKey: string): Promise<void> {
    await this.gatesRepo.delete({ feature_key: featureKey });
    this.invalidateCache();
  }

  invalidateCache(): void {
    this.cache = null;
    this.cacheExpiry = 0;
  }

  private async ensureCache(): Promise<void> {
    if (this.cache && Date.now() < this.cacheExpiry) return;

    const gates = await this.gatesRepo.find();
    this.cache = new Map(gates.map((g) => [g.feature_key, g]));
    this.cacheExpiry = Date.now() + CACHE_TTL_MS;
  }
}
