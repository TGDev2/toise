#!/usr/bin/env node
// Classe les migrations ajoutées entre deux références git : « expand »
// (compatible avec la version précédente du code) ou « contract ». — E6-5.
//
// Ce que cette classification décide, très concrètement : si un retour arrière
// peut se contenter de repasser les images, ou s'il exige de restaurer le dump
// pré-déploiement — en perdant toutes les écritures depuis. La doctrine est
// dans docs/deploy/MIGRATIONS.md ; ce script existe pour qu'elle ne dépende pas
// de la mémoire de celui qui relit la PR.
//
//   node docs/deploy/check-migration-compat.mjs --base origin/main
//   node docs/deploy/check-migration-compat.mjs --base v1.1.0 --head v1.2.0
//
// Sortie 0 si la version est « expand », ou « contract » explicitement assumée.
// Sortie 1 si une migration ajoutée fait quelque chose de destructif sans le
// déclarer : l'oubli est alors rouge, pas silencieux.
//
// **L'oubli est sûr dans le bon sens** : une migration purement additive n'a
// rien à déclarer. Seul le geste destructif demande une annotation, à l'endroit
// exact où il est écrit.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const MIGRATIONS_DIR = 'apps/api/src/migrations';
const ANNOTATION = '@compat contract';

// Motifs dont l'incompatibilité avec la version N-1 du code, ou la perte de
// données, ne se discute pas. Volontairement courte : un garde-fou qui crie au
// loup finit désactivé. Les cas ambigus — index UNIQUE sur une colonne
// existante, rétrécissement de type — sont traités par MIGRATIONS.md, qui
// demande le jugement de l'auteur ; ce script ne prétend pas les couvrir et le
// dit dans son propre message.
const DESTRUCTIVE_PATTERNS = [
  { label: 'DROP COLUMN', re: /\bDROP\s+COLUMN\b/i },
  { label: 'DROP TABLE', re: /\bDROP\s+TABLE\b/i },
  { label: 'RENAME', re: /\bRENAME\b/i },
  { label: 'SET NOT NULL', re: /\bSET\s+NOT\s+NULL\b/i },
  { label: 'DELETE FROM', re: /\bDELETE\s+FROM\b/i },
  { label: 'TRUNCATE', re: /\bTRUNCATE\b/i },
];

function parseArgs(argv) {
  const args = { base: 'origin/main', head: 'HEAD' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base') args.base = argv[(i += 1)];
    else if (argv[i] === '--head') args.head = argv[(i += 1)];
    else if (argv[i] === '-h' || argv[i] === '--help') args.help = true;
    else {
      console.error(`Option inconnue: ${argv[i]}`);
      process.exit(1);
    }
  }
  return args;
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/**
 * Retire commentaires de ligne et de bloc avant de chercher les motifs.
 * Sans cela, la migration qui *explique* pourquoi elle évite un `DROP COLUMN`
 * serait signalée pour l'avoir écrit — et la première fausse alerte est ce qui
 * fait désinstaller un garde-fou.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/**
 * N'analyse que `up()`. Les `down()` de ce dépôt sont pleins de gestes
 * destructifs (TRUNCATE CASCADE, DELETE) et c'est précisément parce qu'ils ne
 * sont pas un outil de production qu'on ne les classe pas : seul ce que la
 * migration fait *en avant* engage la compatibilité de la version.
 */
function upBody(source) {
  const start = source.search(/\basync\s+up\s*\(/);
  if (start === -1) return source;
  const end = source.search(/\basync\s+down\s*\(/);
  return end === -1 || end < start ? source.slice(start) : source.slice(start, end);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(
    'Usage: check-migration-compat.mjs [--base <ref>] [--head <ref>]\n' +
      '  --base  référence de comparaison (défaut: origin/main)\n' +
      '  --head  référence analysée (défaut: HEAD)',
  );
  process.exit(0);
}

let added;
try {
  added = git(
    'diff',
    '--name-only',
    '--diff-filter=A',
    `${args.base}...${args.head}`,
    '--',
    MIGRATIONS_DIR,
  )
    .split('\n')
    .filter((line) => line.endsWith('.ts'));
} catch {
  console.error(
    `ERREUR: impossible de comparer ${args.base}...${args.head}. ` +
      'Un historique complet est nécessaire (actions/checkout avec fetch-depth: 0).',
  );
  process.exit(1);
}

// Migrations pas encore commitées (nouvelles, non suivies ou seulement
// indexées). Sans elles, l'auteur qui lance ce contrôle avant de commiter
// obtient « rien à signaler » sur la migration qu'il vient d'écrire — le seul
// moment où le verdict lui sert encore à quelque chose. En CI il n'y a pas de
// fichier non commité : la sémantique y est inchangée.
try {
  const pending = git('status', '--porcelain', '--', MIGRATIONS_DIR)
    .split('\n')
    .filter((line) => /^(\?\?|A[ M]|M[ M]) /.test(line))
    .map((line) => line.slice(3).replace(/^"|"$/g, ''))
    .filter((file) => file.endsWith('.ts') && !added.includes(file));
  added.push(...pending);
} catch {
  // `git status` indisponible : on se contente de l'intervalle.
}

if (added.length === 0) {
  console.log(`Aucune migration ajoutée entre ${args.base} et ${args.head}.`);
  console.log('COMPAT=expand');
  process.exit(0);
}

const undeclared = [];
const declared = [];

/**
 * Contenu du fichier **à la référence analysée**, et non dans l'arbre de
 * travail : une migration ajoutée puis supprimée dans l'intervalle ferait
 * autrement planter la lecture. Repli sur le disque pour l'usage local, où la
 * migration qu'on vient d'écrire n'est pas encore commitée.
 */
function sourceAt(ref, file) {
  try {
    return execFileSync('git', ['show', `${ref}:${file}`], {
      encoding: 'utf8',
      // stderr ignoré : le repli sur le disque est le cas nominal pour une
      // migration pas encore commitée, pas une anomalie à afficher.
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return readFileSync(file, 'utf8');
  }
}

for (const file of added) {
  const source = sourceAt(args.head, file);
  const body = stripComments(upBody(source));
  const hits = DESTRUCTIVE_PATTERNS.filter((p) => p.re.test(body)).map(
    (p) => p.label,
  );
  if (hits.length === 0) continue;
  // L'annotation est cherchée dans le fichier entier, commentaires compris :
  // c'est un commentaire.
  if (source.includes(ANNOTATION)) declared.push({ file, hits });
  else undeclared.push({ file, hits });
}

console.log(
  `${added.length} migration(s) ajoutée(s) entre ${args.base} et ${args.head} :`,
);
for (const file of added) console.log(`  - ${file}`);

if (undeclared.length > 0) {
  console.error('\nMigrations destructives non déclarées :');
  for (const { file, hits } of undeclared) {
    console.error(`  - ${file} → ${hits.join(', ')}`);
  }
  console.error(
    `\nCes migrations empêchent un retour arrière par simple bascule d'images :\n` +
      `la version N-1 du code tournerait contre un schéma amputé, ou des données\n` +
      `détruites par up() ne reviendraient d'aucun down().\n\n` +
      `Deux issues, décrites dans docs/deploy/MIGRATIONS.md :\n` +
      `  - découper en « expand » maintenant / « contract » à la version suivante ;\n` +
      `  - ou assumer le point de non-retour en écrivant « ${ANNOTATION} »\n` +
      `    en commentaire dans la migration, ce qui le fera apparaître dans le\n` +
      `    résumé du déploiement.\n\n` +
      `Ce contrôle ne voit que des motifs SQL. Un index UNIQUE sur une colonne\n` +
      `existante ou un rétrécissement de type sont tout aussi contraignants et\n` +
      `lui échappent : la relecture reste due.`,
  );
  console.log('COMPAT=contract');
  process.exit(1);
}

if (declared.length > 0) {
  console.log('\nMigrations contractantes assumées (point de non-retour) :');
  for (const { file, hits } of declared) {
    console.log(`  - ${file} → ${hits.join(', ')}`);
  }
  console.log(
    '\nUn retour arrière par bascule d’images ne suffira PAS pour cette version.',
  );
  console.log('COMPAT=contract');
  process.exit(0);
}

console.log('\nToutes additives : retour arrière par bascule d’images possible.');
console.log('COMPAT=expand');
