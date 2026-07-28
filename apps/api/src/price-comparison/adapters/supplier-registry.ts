import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupplierAdapter } from './supplier-adapter.interface';
import { ManoManoAdapter } from './manomano/manomano.adapter';

@Injectable()
export class SupplierRegistry {
  private readonly logger = new Logger(SupplierRegistry.name);
  private readonly adapters: SupplierAdapter[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly manoManoAdapter: ManoManoAdapter,
  ) {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    if (
      this.configService.get<boolean>('priceComparison.manoMano.enabled', false)
    ) {
      this.register(this.manoManoAdapter);
    }

    if (this.adapters.length === 0) {
      this.logger.warn(
        'Aucun adaptateur fournisseur enregistré. La fonctionnalité ' +
          'price_comparison renverra des résultats vides si sa feature gate ' +
          'est activée.',
      );
    }
  }

  register(adapter: SupplierAdapter): void {
    this.adapters.push(adapter);
  }

  getAdapter(supplierKey: string): SupplierAdapter | undefined {
    return this.adapters.find((a) => a.supplierKey === supplierKey);
  }

  getAllAdapters(): SupplierAdapter[] {
    return [...this.adapters];
  }
}
