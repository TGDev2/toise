import { DataSource, DataSourceOptions } from 'typeorm';
import { readdirSync } from 'fs';
import { join } from 'path';

/**
 * Harnais des tests d'intégration : un vrai PostgreSQL, les vraies migrations,
 * les vraies entités.
 *
 * Volontairement sans NestJS : ce que ces tests couvrent — cascades, contraintes,
 * transactions, validité des migrations — est du ressort de la base, pas du
 * conteneur d'injection. Monter `AppModule` exigerait des credentials Firebase et
 * Stripe qu'aucune CI ne devrait détenir, sans rien ajouter à ces vérifications.
 * Cf. `test/README.md` pour ce que chaque étage de tests couvre et ne couvre pas.
 */

const SRC = join(__dirname, '..', '..', 'src');

const CONNECTION = {
  type: 'postgres' as const,
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'chiffreo',
  password: process.env.DB_PASSWORD ?? 'chiffreo_dev',
};

/**
 * Base jetable, jamais celle de développement : elle est **supprimée** à chaque
 * démarrage de suite. Le défaut ne doit donc surtout pas valoir `DB_NAME`.
 */
export const TEST_DB_NAME =
  process.env.INTEGRATION_DB_NAME ?? 'chiffreo_integration_test';

export function testDataSourceOptions(): DataSourceOptions {
  return {
    ...CONNECTION,
    database: TEST_DB_NAME,
    entities: [join(SRC, '**', '*.entity.{ts,js}')],
    migrations: [join(SRC, 'migrations', '*.{ts,js}')],
    synchronize: false,
    logging: false,
  };
}

/** Nombre de fichiers de migration sur le disque — l'attendu de `runMigrations`. */
export function migrationFileCount(): number {
  return readdirSync(join(SRC, 'migrations')).filter((f) => f.endsWith('.ts'))
    .length;
}

/** Repart d'une base vierge : c'est ce qui rend le test des migrations probant. */
export async function recreateTestDatabase(): Promise<void> {
  const admin = new DataSource({ ...CONNECTION, database: 'postgres' });
  await admin.initialize();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  } finally {
    await admin.destroy();
  }
}

export async function migratedDataSource(): Promise<DataSource> {
  await recreateTestDatabase();
  const dataSource = new DataSource(testDataSourceOptions());
  await dataSource.initialize();
  await dataSource.runMigrations();
  return dataSource;
}

/**
 * Isolation entre tests. `users` est la racine du graphe applicatif
 * (organisations → projets → géométrie/photos/estimations) : le `CASCADE` de
 * TRUNCATE suit ces liens et laisse intacts les catalogues semés par les
 * migrations, qui ne référencent aucun utilisateur.
 */
export async function truncateUserData(dataSource: DataSource): Promise<void> {
  await dataSource.query('TRUNCATE TABLE users CASCADE');
  await dataSource.query('TRUNCATE TABLE stripe_events CASCADE');
}
