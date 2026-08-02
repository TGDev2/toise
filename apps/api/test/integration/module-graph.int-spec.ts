import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { migratedDataSource, testDataSourceOptions } from './test-database';

/**
 * Le graphe d'injection se résout-il ? — c'est-à-dire : l'application démarre-t-elle ?
 *
 * ## Pourquoi ce fichier existe
 *
 * 1 025 tests unitaires et 186 tests e2e étaient verts pendant que `node dist/main.js`
 * refusait de démarrer, sur deux `UnknownDependenciesException` distinctes. Aucune de
 * ces suites ne pouvait le voir, et `test/README.md` le disait déjà noir sur blanc :
 * « aucune de ces suites ne monte `AppModule` ». Le vert attestait le contrat HTTP de
 * contrôleurs montés un par un, jamais l'assemblage.
 *
 * La cause était la même deux fois : un guard appliqué par `@UseGuards` est instancié
 * dans l'injecteur du module **appelant**, pas dans celui qui le fournit. Chaque module
 * protégeant une route devait donc réimporter les dépendances du guard —
 * `OrgContextModule` pour `FeatureGateGuard`, `UsersModule` pour `AdminGuard`. Douze
 * modules portaient la première parade, trois la seconde ; le premier oubli tuait
 * l'application entière, en production comme ici.
 *
 * ## Ce que ce test couvre, et ce qu'il ne couvre pas
 *
 * Il couvre la résolution **complète** du graphe : chaque provider de chaque module est
 * instancié par `.compile()`. Une dépendance manquante, un cycle, un `exports` oublié
 * échouent ici.
 *
 * Il ne couvre pas les hooks de cycle de vie (`onModuleInit`), qui demandent `.init()`
 * et de vrais services externes. Un démarrage réel reste plus large que ce test — mais
 * les deux pannes qui ont motivé ce fichier tombaient toutes deux dans `.compile()`.
 *
 * Il vit dans la suite d'intégration parce qu'il lui faut un vrai PostgreSQL :
 * `TypeOrmModule.forRootAsync` ouvre la connexion pendant l'instanciation.
 */
describe('Graphe d’injection de l’application', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    // Crée et migre la base jetable ; `AppModule` s'y connectera via les mêmes
    // variables d'environnement.
    dataSource = await migratedDataSource();

    const options = testDataSourceOptions() as { database: string };
    process.env.DB_NAME = options.database;
  }, 180000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('résout chaque dépendance de chaque module — l’application peut démarrer', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  }, 180000);
});
