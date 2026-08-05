import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { EXCLUDED_ENTITIES, EXPORTED_ENTITIES } from './data-export.service';

/**
 * Garde-fou anti-oubli (esprit leçon 15 de `tasks/lessons.md`) : toute entité
 * `apps/api/src/**\/*.entity.ts` doit être classée soit dans `EXPORTED_ENTITIES`
 * soit dans `EXCLUDED_ENTITIES` (avec raison). Une entité future ajoutée sans y
 * être répertoriée fait échouer ce test plutôt que de sortir silencieusement du
 * périmètre RGPD de `DataExportService`.
 *
 * Lecture directe du système de fichiers, pas d'import des classes d'entité :
 * ce test doit rester vrai même pour une entité qu'on aurait oublié de câbler
 * dans `TypeOrmModule.forRootAsync` — c'est justement le genre d'oubli qu'il
 * doit attraper.
 */
describe('DataExportService — couverture des entités', () => {
  function findEntityFiles(dir: string): string[] {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...findEntityFiles(fullPath));
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.entity.ts')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  function extractTableName(filePath: string): string {
    const content = readFileSync(filePath, 'utf-8');
    const match = content.match(/@Entity\(\s*['"]([^'"]+)['"]/);
    if (!match) {
      throw new Error(
        `Impossible d'extraire le nom de table de ${filePath} — ` +
          `@Entity('table_name') attendu sous forme littérale.`,
      );
    }
    return match[1];
  }

  it('classe chaque entité du dépôt comme exportée ou explicitement exclue', () => {
    const srcRoot = join(__dirname, '..');
    const entityFiles = findEntityFiles(srcRoot);
    expect(entityFiles.length).toBeGreaterThan(0);

    const tableNames = entityFiles.map(extractTableName);
    const excludedTables = new Set(EXCLUDED_ENTITIES.map((e) => e.table));
    const exportedTables = new Set(EXPORTED_ENTITIES);

    const unclassified = tableNames.filter(
      (table) => !excludedTables.has(table) && !exportedTables.has(table),
    );

    expect(unclassified).toEqual([]);
  });

  it("n'exclut aucune table sans raison", () => {
    for (const entry of EXCLUDED_ENTITIES) {
      expect(entry.reason.trim().length).toBeGreaterThan(10);
    }
  });

  it('ne classe aucune table à la fois exportée et exclue', () => {
    const excludedTables = new Set(EXCLUDED_ENTITIES.map((e) => e.table));
    const overlap = EXPORTED_ENTITIES.filter((table) =>
      excludedTables.has(table),
    );
    expect(overlap).toEqual([]);
  });
});
