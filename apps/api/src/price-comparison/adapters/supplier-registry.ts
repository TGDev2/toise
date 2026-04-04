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
    const mockEnabled = this.configService.get<boolean>(
      'priceComparison.mockEnabled',
      true,
    );

    if (mockEnabled) {
      this.register(new MockSupplierAdapter('home_depot_mock'));
      this.register(new MockSupplierAdapter('lowes_mock'));
      this.register(new MockSupplierAdapter('local_mock'));
      this.logger.log('Registered 3 mock supplier adapters');
    }

    // Real adapters will be registered here after the spike, e.g.:
    // if (this.configService.get<boolean>('priceComparison.homeDepot.enabled')) {
    //   this.register(homeDepotAdapter);
    // }
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
