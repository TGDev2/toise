import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupplierAdapter } from './supplier-adapter.interface';
import { MockSupplierAdapter } from './mock-supplier.adapter';

@Injectable()
export class SupplierRegistry {
  private readonly logger = new Logger(SupplierRegistry.name);
  private readonly adapters: SupplierAdapter[] = [];

  constructor(private readonly configService: ConfigService) {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // Mock adapters are strictly opt-in (dev/test only). They generate
    // fabricated CAD prices and must never be registered in production
    // while the `price_comparison` feature gate is live for paying users.
    const mockEnabled = this.configService.get<boolean>(
      'priceComparison.mockEnabled',
      false,
    );

    if (mockEnabled) {
      this.register(new MockSupplierAdapter('home_depot_mock'));
      this.register(new MockSupplierAdapter('lowes_mock'));
      this.register(new MockSupplierAdapter('local_mock'));
      this.logger.warn(
        'Registered 3 MOCK supplier adapters — prices are fabricated. ' +
          'This must only happen in dev/test (PRICE_MOCK_ENABLED=true).',
      );
    }

    // Real adapters will be registered here once integrated, e.g.:
    // if (this.configService.get<boolean>('priceComparison.homeDepot.enabled')) {
    //   this.register(homeDepotAdapter);
    // }

    if (this.adapters.length === 0) {
      this.logger.warn(
        'No supplier adapters registered. The price_comparison feature ' +
          'will return empty results if its feature gate is enabled.',
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
