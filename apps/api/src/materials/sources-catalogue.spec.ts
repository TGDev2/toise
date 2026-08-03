import { readFileSync } from 'fs';
import { resolve } from 'path';
import { seedMaterials } from './seed-catalog.data';
import { workTypeMaterialLinks } from './work-type-materials.data';

/**
 * E1-7 — la traçabilité est un contrat, pas une intention : chaque matériau
 * servi par un ouvrage V1 doit avoir sa ligne dans docs/SOURCES_CATALOGUE.md
 * (source + date), le rendement du registre doit être celui du seed, et un
 * matériau « retiré » ne doit plus être lié. Sans ce spec, la prochaine
 * liaison ajoutée sans source — ou le prochain rendement corrigé sans mise à
 * jour du registre — passerait en silence.
 *
 * Le format du tableau (7 colonnes, en-têtes exacts) est contractuel :
 * renommer une colonne casse ce spec, c'est voulu.
 */

const DOC = resolve(__dirname, '../../../../docs/SOURCES_CATALOGUE.md');

interface SourceRow {
  name: string;
  category: string;
  yield_v1: string;
  decision: string;
  source: string;
  date: string;
}

const rows: SourceRow[] = readFileSync(DOC, 'utf8')
  .split('\n')
  .filter((line) => line.startsWith('|'))
  .map((line) => line.split('|').map((cell) => cell.trim()))
  .filter(
    (cells) =>
      cells.length === 9 &&
      cells[1] !== 'Matériau' &&
      !/^[-\s]*$/.test(cells[1]),
  )
  .map((cells) => ({
    name: cells[1],
    category: cells[2],
    yield_v1: cells[3],
    decision: cells[5],
    source: cells[6],
    date: cells[7],
  }));

const rowByKey = new Map(rows.map((r) => [`${r.category}:${r.name}`, r]));
const seedByKey = new Map(
  seedMaterials.map((m) => [`${m.category}:${m.name}`, m]),
);
const linkedKeys = [
  ...new Set(
    workTypeMaterialLinks.map(
      (l) => `${l.material_category}:${l.material_name}`,
    ),
  ),
];

describe('SOURCES_CATALOGUE.md — registre des rendements V1', () => {
  it('contient les 49 lignes de la curation E1-3, retraits compris', () => {
    // Garde anti-vacuité : un tableau vide ou mal parsé doit échouer fort,
    // pas faire passer les assertions suivantes sur zéro ligne.
    expect(rows.length).toBeGreaterThanOrEqual(49);
  });

  it('couvre chaque matériau lié par une décision conserver/corriger sourcée', () => {
    for (const key of linkedKeys) {
      const row = rowByKey.get(key);
      expect(row).toBeDefined();
      expect(row!.decision).toMatch(/^(conserver|corriger)/);
      expect(row!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Un rendement définitionnel (produit vendu au m², posé bord à bord)
      // n'a pas de chiffre de fiche à citer ; tout le reste porte son URL.
      if (!row!.decision.includes('définitionnel')) {
        expect(row!.source).toMatch(/^https?:\/\//);
      }
    }
  });

  it('affiche dans le registre le rendement réellement seedé', () => {
    for (const key of linkedKeys) {
      const row = rowByKey.get(key)!;
      const seed = seedByKey.get(key)!;
      expect(seed).toBeDefined();
      expect(Number(row.yield_v1)).toBe(seed.yield_per_unit);
    }
  });

  it('ne laisse aucun matériau « retiré » lié à un ouvrage', () => {
    const retired = rows.filter((r) => r.decision.startsWith('retirer'));
    expect(retired.length).toBeGreaterThan(0);
    for (const row of retired) {
      expect(linkedKeys).not.toContain(`${row.category}:${row.name}`);
    }
  });

  it('ne documente que des matériaux qui existent au catalogue seedé', () => {
    for (const row of rows) {
      expect(seedByKey.has(`${row.category}:${row.name}`)).toBe(true);
    }
  });
});
