/**
 * Relevé statique de la navigation web.
 *
 * Sert `src/__tests__/navigation-reachability.spec.ts`, qui fait respecter le
 * §3.4 de l'ADR 0001 — « toute ligne vendue doit être atteignable depuis la
 * navigation » — et son extension : rien de gelé ne doit être atteignable par
 * personne.
 *
 * ## Pourquoi un relevé statique et pas un parcours navigateur
 *
 * Un crawler ne voit que ce qu'il a réussi à faire rendre. L'atteignabilité
 * dépend ici de l'état des données autant que du palier : le bouton « Suivi de
 * chantier » n'apparaissait que pour `subscription_tier` commençant par
 * `contractor`, « Partager » que sur un chantier `completed`. Être exhaustif
 * imposerait le produit cartésien palier × état, et **tout état oublié serait
 * un angle mort silencieux** — la suite au vert pendant que le bouton existe.
 *
 * Le relevé statique voit tout l'arbre, y compris les chemins qu'aucun parcours
 * n'atteindrait. Il **sur-approxime volontairement** : une arête est retenue dès
 * que la cible apparaît dans la clôture de sources d'une route, sans tenir
 * compte des conditions de rendu. C'est le sens sûr pour la règle du gel — on ne
 * peut pas manquer un chemin.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il ne comprend pas une cible construite hors littéral (`router.push(target)`
 * où `target` est une variable). C'est pourquoi le spec assert que **toute**
 * cible extraite se résout vers une route connue : une cible non comprise doit
 * faire rougir, jamais disparaître en silence.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';

/** `src/` — ce fichier vit dans `src/__tests__/support/`. */
export const SRC_DIR = resolve(__dirname, '..', '..');
export const APP_DIR = join(SRC_DIR, 'app');

/** Marqueur d'un segment d'URL interpolé (`${projectId}`). */
const DYNAMIC = '*';

/**
 * Retire commentaires de ligne et de bloc en respectant chaînes et gabarits.
 *
 * Indispensable : ce dépôt commente abondamment, et plusieurs commentaires
 * citent des routes (`dashboard/page.tsx` décrit un bouton qui menait « à
 * /projects/<uuid-local>/dimensions »). Sans cette passe, un commentaire
 * suffirait à créer une arête — un faux positif.
 *
 * Les caractères retirés sont remplacés par des espaces plutôt que supprimés :
 * les décalages restent lisibles en cas de mise au point.
 */
export function stripComments(source: string): string {
  let out = '';
  let i = 0;
  const n = source.length;

  while (i < n) {
    const char = source[i];
    const next = source[i + 1];

    if (char === '/' && next === '/') {
      while (i < n && source[i] !== '\n') {
        out += ' ';
        i += 1;
      }
      continue;
    }

    if (char === '/' && next === '*') {
      out += '  ';
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      out += '  ';
      i += 2;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      out += char;
      i += 1;
      while (i < n) {
        if (source[i] === '\\') {
          out += source[i] + (source[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += source[i];
        const closed = source[i] === char;
        i += 1;
        if (closed) break;
      }
      continue;
    }

    out += char;
    i += 1;
  }

  return out;
}

function listFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...listFiles(full));
    } else if (entry.isFile()) {
      found.push(full);
    }
  }
  return found;
}

/** Chemin de route Next.js d'un `page.tsx` : les groupes `(app)` s'effacent. */
export function routeOf(pageFile: string): string {
  const segments = relative(APP_DIR, dirname(pageFile))
    .split(sep)
    .filter((segment) => segment !== '' && !/^\(.*\)$/.test(segment));
  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

/** Toutes les routes servies par un `page.tsx`, dans l'ordre alphabétique. */
export function listRouteFiles(): { route: string; file: string }[] {
  return listFiles(APP_DIR)
    .filter((file) => file.endsWith(`${sep}page.tsx`))
    .map((file) => ({ route: routeOf(file), file }))
    .sort((a, b) => a.route.localeCompare(b.route));
}

/** Layouts qui enveloppent une page, de la plus proche à la racine. */
function layoutsFor(pageFile: string): string[] {
  const layouts: string[] = [];
  let dir = dirname(pageFile);
  for (;;) {
    const candidate = join(dir, 'layout.tsx');
    if (existsSync(candidate)) layouts.push(candidate);
    if (dir === APP_DIR) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return layouts;
}

function resolveImport(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) {
    base = join(SRC_DIR, specifier.slice(2));
  } else if (specifier.startsWith('./') || specifier.startsWith('../')) {
    base = resolve(dirname(fromFile), specifier);
  } else {
    // Paquet tiers (`next/link`, `react`) : hors du périmètre du produit.
    return null;
  }

  const candidates = [
    `${base}.tsx`,
    `${base}.ts`,
    join(base, 'index.tsx'),
    join(base, 'index.ts'),
  ];
  return (
    candidates.find(
      (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
    ) ?? null
  );
}

const IMPORT_RE = /\b(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

/**
 * Clôture de sources d'une route : sa page, ses layouts, et tout module local
 * atteint transitivement par un `import`.
 *
 * Un composant partagé contribue donc ses liens à **toutes** les routes qui
 * l'importent. C'est la sur-approximation assumée : elle ajoute des arêtes,
 * jamais n'en retire.
 */
export function sourceClosure(pageFile: string): string[] {
  const seen = new Set<string>();
  const queue = [pageFile, ...layoutsFor(pageFile)];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);

    const code = stripComments(readFileSync(file, 'utf8'));
    for (const match of code.matchAll(IMPORT_RE)) {
      const resolved = resolveImport(match[1], file);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }

  return [...seen].sort();
}

const NAV_CALL_RE =
  /\b(?:router\s*\.\s*(?:push|replace)|redirect)\s*\(\s*(['"`])([^'"`]*)\1/g;
const HREF_RE = /\bhref\s*=\s*\{?\s*(['"`])([^'"`]*)\1/g;
const GATE_CALL_RE =
  /\b(?:isFeatureAllowed|showPaywall|getGateConfig)\s*\(\s*(['"`])([a-z_]+)\1/g;

/**
 * Cible brute → chemin comparable, ou `null` si elle ne désigne pas une route
 * interne (URL externe, ancre, chemin relatif).
 */
export function normaliseTarget(raw: string): string | null {
  const interpolated = raw.trim().replace(/\$\{[^}]*\}/g, DYNAMIC);
  const withoutQuery = interpolated.split('?')[0].split('#')[0];
  if (!withoutQuery.startsWith('/')) return null;

  const segments = withoutQuery
    .split('/')
    .filter((segment) => segment !== '')
    .map((segment) =>
      // `work-selection${nextQ}` : l'interpolation est un suffixe de requête,
      // pas un segment. Un segment entièrement interpolé reste dynamique.
      segment === DYNAMIC ? DYNAMIC : segment.split(DYNAMIC).join(''),
    );

  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}

/** Cibles de navigation littérales trouvées dans un fichier déjà décommenté. */
function targetsIn(code: string): string[] {
  const raw: string[] = [];
  for (const match of code.matchAll(NAV_CALL_RE)) raw.push(match[2]);
  for (const match of code.matchAll(HREF_RE)) raw.push(match[2]);
  return raw
    .map(normaliseTarget)
    .filter((target): target is string => target !== null);
}

/** Clés de gates consultées dans un fichier déjà décommenté. */
function gatesIn(code: string): string[] {
  return [...code.matchAll(GATE_CALL_RE)].map((match) => match[2]);
}

/**
 * Résout une cible vers une route déclarée. Un chemin littéral l'emporte sur un
 * segment paramétré — c'est la règle de Next.js, et c'est ce qui distingue
 * `/admin/materials/new` de `/admin/materials/[id]`.
 */
export function resolveTarget(target: string, routes: string[]): string | null {
  if (routes.includes(target)) return target;

  const targetSegments = target.split('/').filter(Boolean);
  return (
    routes.find((route) => {
      const routeSegments = route.split('/').filter(Boolean);
      if (routeSegments.length !== targetSegments.length) return false;
      return routeSegments.every((segment, index) => {
        const isParam = segment.startsWith('[') && segment.endsWith(']');
        const targetSegment = targetSegments[index];
        return isParam ? true : segment === targetSegment;
      });
    }) ?? null
  );
}

export interface RouteNode {
  /** Chemin Next.js, groupes retirés (`/projects/[id]/dimensions`). */
  route: string;
  /** `page.tsx` qui la sert. */
  file: string;
  /** Routes vers lesquelles sa clôture de sources sait naviguer. */
  targets: string[];
  /** Gates que sa clôture de sources consulte. */
  gates: string[];
  /** Cibles internes que le relevé n'a pas su rattacher à une route. */
  unresolved: string[];
}

export interface NavigationGraph {
  routes: string[];
  nodes: RouteNode[];
  /** Routes consultant une gate donnée. */
  routesUsingGate(gateKey: string): string[];
}

export function buildNavigationGraph(): NavigationGraph {
  const pages = listRouteFiles();
  const routes = pages.map((page) => page.route);

  const nodes = pages.map(({ route, file }): RouteNode => {
    const targets = new Set<string>();
    const gates = new Set<string>();
    const unresolved = new Set<string>();

    for (const source of sourceClosure(file)) {
      const code = stripComments(readFileSync(source, 'utf8'));
      for (const target of targetsIn(code)) {
        const resolved = resolveTarget(target, routes);
        if (resolved === null) unresolved.add(target);
        else if (resolved !== route) targets.add(resolved);
      }
      for (const gate of gatesIn(code)) gates.add(gate);
    }

    return {
      route,
      file,
      targets: [...targets].sort(),
      gates: [...gates].sort(),
      unresolved: [...unresolved].sort(),
    };
  });

  return {
    routes,
    nodes,
    routesUsingGate: (gateKey) =>
      nodes.filter((node) => node.gates.includes(gateKey)).map((node) => node.route),
  };
}

/** Routes atteignables depuis les racines, par parcours en largeur. */
export function reachableFrom(
  graph: NavigationGraph,
  roots: readonly string[],
): Set<string> {
  const byRoute = new Map(graph.nodes.map((node) => [node.route, node]));
  const reached = new Set<string>();
  const queue = [...roots];

  while (queue.length > 0) {
    const route = queue.shift()!;
    if (reached.has(route)) continue;
    reached.add(route);
    for (const target of byRoute.get(route)?.targets ?? []) {
      if (!reached.has(target)) queue.push(target);
    }
  }

  return reached;
}
