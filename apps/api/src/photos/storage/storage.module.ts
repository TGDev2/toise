import { Module } from '@nestjs/common';
import { STORAGE_PROVIDER } from './storage.interface';
import { LocalStorageService } from './local-storage.service';

/**
 * Le volume de fichiers a deux consommateurs depuis E6-1 : le module photos, qui
 * écrit, et `DataRetentionService`, qui efface. Il cesse donc d'être un détail
 * interne au premier — d'où ce module minuscule, dont l'unique rôle est de
 * fournir `STORAGE_PROVIDER` à qui l'importe.
 */
@Module({
  providers: [{ provide: STORAGE_PROVIDER, useClass: LocalStorageService }],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
