import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { numericTransformer } from './numeric.transformer';

describe('numericTransformer', () => {
  it('convertit la chaîne renvoyée par le pilote pg', () => {
    expect(numericTransformer.from('12.50')).toBe(12.5);
    expect(numericTransformer.from('0')).toBe(0);
    expect(numericTransformer.from('-3.25')).toBe(-3.25);
  });

  it('laisse passer null sans le transformer en 0', () => {
    // `Number(null)` vaut 0 : une colonne nullable deviendrait « gratuit »
    // au lieu de « non renseigné ».
    expect(numericTransformer.from(null)).toBeNull();
  });

  it('est idempotent sur un nombre déjà converti', () => {
    expect(numericTransformer.from(12.5)).toBe(12.5);
  });

  it('rend une addition arithmétique, pas une concaténation', () => {
    const a = numericTransformer.from('10.00') as number;
    const b = numericTransformer.from('2.50') as number;
    expect(a + b).toBe(12.5);
  });
});

/**
 * Le constat d'origine n'était pas « telle colonne est fausse » mais « rien
 * n'empêche la suivante de l'être » : le type déclaré ment, donc le compilateur
 * ne peut rien signaler. Ce test tient l'invariant à l'échelle du schéma.
 */
describe('schéma : toute colonne numeric déclarée number porte le transformer', () => {
  const srcRoot = join(__dirname, '..', '..');
  const entityFiles = readdirSync(srcRoot, {
    recursive: true,
    encoding: 'utf8',
  })
    .filter((name) => name.endsWith('.entity.ts'))
    .map((name) => join(srcRoot, name));

  it('trouve les entités du projet', () => {
    expect(entityFiles.length).toBeGreaterThan(20);
  });

  it("n'en laisse aucune sans transformateur", () => {
    const offenders: string[] = [];

    for (const file of entityFiles) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!line.includes("type: 'numeric'")) return;
        // La déclaration peut tenir sur une ou plusieurs lignes : on lit le
        // bloc jusqu'à la propriété qu'il décore.
        const block: string[] = [];
        for (let j = i; j < lines.length && j < i + 12; j++) {
          block.push(lines[j]);
          if (/!:\s/.test(lines[j])) break;
        }
        const joined = block.join(' ');
        const declaresNumber = /!:\s*number\b/.test(joined);
        const hasTransformer = joined.includes('transformer:');
        if (declaresNumber && !hasTransformer) {
          offenders.push(`${file}:${i + 1} → ${joined.trim()}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
