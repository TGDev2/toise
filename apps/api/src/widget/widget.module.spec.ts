import { ApiKeysModule } from '../api-keys/api-keys.module';
import { QuotaConsumptionInterceptor } from '../api-keys/interceptors/quota-consumption.interceptor';
import { WidgetModule } from './widget.module';
import { WidgetPublicController } from './widget-public.controller';

/**
 * `WidgetPublicController` déclare `@UseInterceptors(QuotaConsumptionInterceptor)`,
 * mais l'intercepteur est fourni par `ApiKeysModule` — le widget partage le
 * compteur de quota de l'API partenaire plutôt que d'en dupliquer un second.
 *
 * Nest ne résout un intercepteur de contrôleur que dans l'injecteur du module
 * qui le déclare : si `ApiKeysModule` cessait de l'exporter, ou `WidgetModule`
 * de l'importer, rien ne le signalerait avant le démarrage de l'application —
 * ni la compilation, ni les specs qui instancient les classes à la main. Cette
 * chaîne d'assemblage est donc vérifiée pour elle-même.
 */
describe('Assemblage du quota widget ↔ API partenaire', () => {
  const imports = Reflect.getMetadata('imports', WidgetModule) as unknown[];
  const exports = Reflect.getMetadata('exports', ApiKeysModule) as unknown[];
  const controllers = Reflect.getMetadata(
    'controllers',
    WidgetModule,
  ) as unknown[];

  it('expose l’intercepteur depuis ApiKeysModule', () => {
    expect(Reflect.getMetadata('providers', ApiKeysModule)).toContain(
      QuotaConsumptionInterceptor,
    );
    expect(exports).toContain(QuotaConsumptionInterceptor);
  });

  it('le rend résoluble dans le module qui déclare le contrôleur widget', () => {
    expect(controllers).toContain(WidgetPublicController);
    expect(imports).toContain(ApiKeysModule);
  });

  it('pose bien l’intercepteur sur le contrôleur widget', () => {
    const interceptors = Reflect.getMetadata(
      '__interceptors__',
      WidgetPublicController,
    ) as unknown[];

    expect(interceptors).toContain(QuotaConsumptionInterceptor);
  });
});
