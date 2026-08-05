import { createReadStream, existsSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { StringDecoder } from 'node:string_decoder';
import dataSource from '../config/data-source';
import {
  MaterialProductMatcher,
  type FeedProduct,
  type MaterialProductMatch,
  type MatchTarget,
} from '../price-comparison/matching/material-product-matcher';
import { CsvRowParser } from '../price-comparison/adapters/shared/csv-row-parser';
import { toFeedProduct } from '../price-comparison/adapters/manomano/manomano-feed.client';

/**
 * E5-4 (docs/BACKLOG_V1.md) : avant d'ouvrir un compte marchand, mesurer
 * combien de lignes d'une vraie liste d'achat porteraient réellement un
 * lien commissionné. Prend un extrait de flux produits obtenu du
 * partenaire (CSV, colonnes Awin/Effiliation/Kwanko — cf.
 * `docs/AFFILIATION_PARTENAIRES.md`) et le confronte au catalogue matériaux
 * réel, sans rien écrire en base ni appeler aucun service réseau.
 *
 * Réutilise le moteur de rapprochement de production tel quel
 * (`MaterialProductMatcher`, `matching/material-product-matcher.ts`) —
 * c'est le même code qui tournera à la synchronisation, pas une
 * approximation.
 *
 * Deux périmètres sont rapportés, parce que le voisinage de rayon change le
 * résultat du matcher (verrou « rival tokens ») :
 * - le catalogue actif complet (`materials_catalog.is_active = true`),
 *   celui que `ManoManoFeedSyncService.loadTargets()` utilise réellement en
 *   production ;
 * - le sous-ensemble effectivement lié à un ouvrage V1
 *   (`work_type_materials`), le seul qui atteint une vraie liste d'achat
 *   aujourd'hui (cf. `docs/SOURCES_CATALOGUE.md`).
 *
 * ```bash
 * # depuis apps/api, avec DB_* dans le .env de la racine
 * pnpm validate:affiliate-feed chemin/vers/extrait.csv
 * pnpm validate:affiliate-feed chemin/vers/extrait.csv.gz
 * ```
 *
 * Volontairement limité à un fichier local : ce script sert à valider un
 * extrait obtenu du partenaire avant tout engagement, pas à synchroniser un
 * flux de production (ça, c'est `ManoManoFeedSyncService`/
 * `LeroyMerlinFeedSyncService`). L'extrait est donc chargé en mémoire plutôt
 * que streamé.
 */

const EXIT_MISCONFIGURED = 2;

interface CatalogRow {
  id: string;
  name: string;
  category: string;
  unit: string;
}

async function readFeed(path: string): Promise<FeedProduct[]> {
  const products: FeedProduct[] = [];
  let rows = 0;

  const parser = new CsvRowParser((record) => {
    rows++;
    const product = toFeedProduct(record);
    if (product) {
      products.push(product);
    }
  });

  const raw = createReadStream(path);
  const source = /\.gz$/i.test(path) ? raw.pipe(createGunzip()) : raw;
  const decoder = new StringDecoder('utf8');

  for await (const chunk of source) {
    parser.push(decoder.write(chunk as Buffer));
  }
  parser.push(decoder.end());
  parser.end();

  console.log(
    `[validate-affiliate-feed] ${rows} ligne(s) lue(s), ${products.length} exploitable(s) ` +
      '(identifiant + titre + prix + lien présents).',
  );
  return products;
}

function toTargets(rows: CatalogRow[]): MatchTarget[] {
  return rows.map((row) => ({
    material_id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
  }));
}

async function loadCatalogTargets(): Promise<MatchTarget[]> {
  const rows: CatalogRow[] = await dataSource.query(
    `SELECT id, name, category, unit FROM materials_catalog WHERE is_active = true ORDER BY name`,
  );
  return toTargets(rows);
}

async function loadV1Targets(): Promise<MatchTarget[]> {
  const rows: CatalogRow[] = await dataSource.query(
    `SELECT DISTINCT m.id, m.name, m.category, m.unit
     FROM materials_catalog m
     INNER JOIN work_type_materials wtm ON wtm.material_id = m.id
     WHERE m.is_active = true
     ORDER BY m.name`,
  );
  return toTargets(rows);
}

/** Un instantané lisible par un humain — pas un JSON à interpréter. */
function report(
  label: string,
  targets: MatchTarget[],
  products: FeedProduct[],
): void {
  console.log(`\n=== ${label} ===`);

  if (targets.length === 0) {
    console.log('Aucun matériau dans ce périmètre.');
    return;
  }

  const matcher = new MaterialProductMatcher(targets);
  for (const product of products) {
    matcher.consider(product);
  }
  const matches = matcher.results();
  const matchedById = new Map<string, MaterialProductMatch>(
    matches.map((match) => [match.material_id, match]),
  );
  const stats = matcher.stats();

  const rate = (matches.length / targets.length) * 100;
  console.log(
    `${matches.length}/${targets.length} matériaux rapprochés (${rate.toFixed(1)} %) — ` +
      `${stats.considered} produit(s) du flux confronté(s) au catalogue.`,
  );

  const byCategory = new Map<string, { total: number; matched: number }>();
  for (const target of targets) {
    const bucket = byCategory.get(target.category) ?? { total: 0, matched: 0 };
    bucket.total++;
    if (matchedById.has(target.material_id)) {
      bucket.matched++;
    }
    byCategory.set(target.category, bucket);
  }

  console.log('\nPar catégorie :');
  for (const [category, bucket] of [...byCategory.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const categoryRate = (bucket.matched / bucket.total) * 100;
    console.log(
      `  ${category.padEnd(14)} ${bucket.matched}/${bucket.total} (${categoryRate.toFixed(1)} %)`,
    );
  }

  console.log('\nMatériau par matériau :');
  for (const target of [...targets].sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const match = matchedById.get(target.material_id);
    if (match) {
      console.log(
        `  ✓ ${target.name} [${target.category}/${target.unit}] → "${match.product.title}" ` +
          `(score ${match.score.toFixed(2)}, conditionnement ${match.pack.qty} ${match.pack.unit})`,
      );
    } else {
      console.log(
        `  ✗ ${target.name} [${target.category}/${target.unit}] — aucun rapprochement`,
      );
    }
  }
}

async function main(): Promise<void> {
  const feedPath = process.argv[2];
  if (!feedPath) {
    console.error(
      'Usage : pnpm validate:affiliate-feed <chemin-vers-extrait-de-flux.csv[.gz]>',
    );
    process.exit(EXIT_MISCONFIGURED);
  }
  if (!existsSync(feedPath)) {
    console.error(
      `[validate-affiliate-feed] fichier introuvable : ${feedPath}`,
    );
    process.exit(EXIT_MISCONFIGURED);
  }

  console.log(`[validate-affiliate-feed] lecture de ${feedPath}…`);
  const products = await readFeed(feedPath);

  await dataSource.initialize();
  try {
    const [catalogTargets, v1Targets] = await Promise.all([
      loadCatalogTargets(),
      loadV1Targets(),
    ]);

    report('Catalogue actif complet', catalogTargets, products);
    report(
      'Sous-ensemble V1 (matériaux liés à un ouvrage)',
      v1Targets,
      products,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('[validate-affiliate-feed] échec :', error);
  process.exit(EXIT_MISCONFIGURED);
});
