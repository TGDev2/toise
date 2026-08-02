import { DataSource } from 'typeorm';
import {
  migrationFileCount,
  migratedDataSource,
  recreateTestDatabase,
  testDataSourceOptions,
} from './test-database';

/**
 * Ce que la suite `*.e2e-spec.ts` ne peut structurellement pas voir : elle mocke
 * les services et ne se connecte à aucune base. Une migration qui ne s'applique
 * pas sur une base vierge, une colonne qu'une entité lit mais qu'aucune migration
 * ne crée, une migration non rejouable — tout cela y reste vert et casse au
 * déploiement.
 */
describe('Schéma (intégration, PostgreSQL réel)', () => {
  let dataSource: DataSource;

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it("applique toutes les migrations sur une base vierge, dans l'ordre", async () => {
    await recreateTestDatabase();
    dataSource = new DataSource(testDataSourceOptions());
    await dataSource.initialize();

    const applied = await dataSource.runMigrations();

    expect(applied).toHaveLength(migrationFileCount());
    // L'ordre d'exécution doit être celui des timestamps : une migration qui
    // dépend d'une table créée plus tard échouerait ici, pas en production.
    const timestamps = applied.map((m) => m.timestamp);
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
  });

  it('est rejouable : une seconde exécution ne fait rien', async () => {
    dataSource = await migratedDataSource();

    expect(await dataSource.runMigrations()).toHaveLength(0);
  });

  it('permet de revenir en arrière puis de ré-appliquer la dernière migration', async () => {
    dataSource = await migratedDataSource();
    const before = migrationFileCount();

    await dataSource.undoLastMigration();
    const afterUndo: unknown[] = await dataSource.query(
      'SELECT id FROM migrations',
    );
    expect(afterUndo).toHaveLength(before - 1);

    expect(await dataSource.runMigrations()).toHaveLength(1);
  });

  it('porte toutes les colonnes que les entités lisent (dérive entités ↔ migrations)', async () => {
    dataSource = await migratedDataSource();

    const existing: { table_name: string; column_name: string }[] =
      await dataSource.query(
        `SELECT table_name, column_name FROM information_schema.columns
         WHERE table_schema = 'public'`,
      );
    const columnsByTable = new Map<string, Set<string>>();
    for (const row of existing) {
      const set = columnsByTable.get(row.table_name) ?? new Set<string>();
      set.add(row.column_name);
      columnsByTable.set(row.table_name, set);
    }

    const missing: string[] = [];
    for (const entity of dataSource.entityMetadatas) {
      const columns = columnsByTable.get(entity.tableName);
      if (!columns) {
        missing.push(`${entity.tableName} (table absente)`);
        continue;
      }
      for (const column of entity.columns) {
        if (!columns.has(column.databaseName)) {
          missing.push(`${entity.tableName}.${column.databaseName}`);
        }
      }
    }

    expect(missing).toEqual([]);
    // Garde-fou : si le chargement des entités échouait silencieusement, la
    // boucle ci-dessus passerait sur zéro entité et ce test ne prouverait rien.
    expect(dataSource.entityMetadatas.length).toBeGreaterThan(30);
  });
});
