import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * Garde-fou du vocabulaire de la promesse produit.
 *
 * Le lexique vit dans `docs/promesse-lexique.json`, avec le `why` de chaque
 * interdiction en commentaire. Le fichier est lu à l'exécution plutôt que
 * recopié ici : l'API porte le même garde-fou, et deux listes concurrentes
 * finiraient par diverger — c'est la plus permissive des deux qui ferait alors
 * autorité, ce qui vaut absence de garde-fou (leçon 15).
 *
 * Le scan passe par l'AST TypeScript et non par une expression régulière sur le
 * fichier brut. La différence n'est pas cosmétique : une trentaine de
 * commentaires du dépôt emploient légitimement « exactement » ou
 * « précisément » pour décrire un mécanisme interne. Les balayer aurait imposé
 * de les réécrire — c'est-à-dire de dégrader la documentation du code pour
 * satisfaire un test. L'AST ne voit que ce qui peut atteindre un écran :
 * littéraux de chaîne, gabarits, et texte JSX.
 *
 * Le balayage part de l'arborescence entière, pas d'une liste de fichiers
 * « sensibles » : un fichier neuf est couvert d'office, et l'oubli est donc sûr
 * (leçon 31). Ce qui doit échapper à la règle le déclare dans `allowed`, avec
 * sa raison — ne rien décider est impossible, décider d'exempter reste
 * possible.
 */

interface ForbiddenTerm {
  id: string;
  pattern: string;
  why: string;
}

interface AllowedPhrase {
  phrase: string;
  files: string[];
  reason: string;
}

interface Lexicon {
  forbidden: ForbiddenTerm[];
  allowed: AllowedPhrase[];
}

const LEXICON_RELATIVE = path.join('docs', 'promesse-lexique.json');

/**
 * Remonte jusqu'au dossier qui porte le lexique. L'ancre est le fichier
 * lui-même et non `pnpm-workspace.yaml` : `apps/web` en possède un aussi, et
 * la recherche s'arrêtait sur le paquet au lieu de la racine.
 */
function findRepoRoot(): string {
  let dir = __dirname;
  for (;;) {
    if (fs.existsSync(path.join(dir, LEXICON_RELATIVE))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error('Racine du dépôt introuvable');
    dir = parent;
  }
}

const REPO_ROOT = findRepoRoot();
const LEXICON_PATH = path.join(REPO_ROOT, LEXICON_RELATIVE);
const SCAN_ROOT = path.join(REPO_ROOT, 'apps', 'web', 'src');

const lexicon: Lexicon = JSON.parse(fs.readFileSync(LEXICON_PATH, 'utf8'));

/** Fichiers qui ne peuvent rien afficher : tests, mocks, fixtures. */
const EXCLUDED = /(__tests__|__mocks__|\.spec\.tsx?$|\.test\.tsx?$|\.fixture\.tsx?$)/;

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      collectSourceFiles(full, out);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (EXCLUDED.test(full.replace(/\\/g, '/'))) continue;
    out.push(full);
  }
  return out;
}

/**
 * Ramène le texte à la forme sur laquelle les motifs sont écrits : apostrophe
 * droite, espaces ordinaires, entités JSX résolues. Sans cette étape,
 * `15 à 25&nbsp;%` et `n’achetez plus` passeraient au travers — ce sont
 * précisément les formes que le JSX produit.
 */
function normalize(text: string): string {
  return text
    .replace(/[‘’ʼ]/g, "'")
    .replace(/&nbsp;| | /g, ' ')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

/** Chaînes atteignables par un écran : littéraux, gabarits, texte JSX. */
function collectDisplayableText(file: string): string[] {
  const content = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    false,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const texts: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      node.kind === ts.SyntaxKind.JsxText
    ) {
      texts.push((node as ts.LiteralLikeNode).text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return texts;
}

interface Violation {
  file: string;
  termId: string;
  match: string;
  context: string;
}

function scan(): Violation[] {
  const violations: Violation[] = [];
  const patterns = lexicon.forbidden.map((term) => ({
    id: term.id,
    regex: new RegExp(term.pattern, 'giu'),
  }));

  for (const file of collectSourceFiles(SCAN_ROOT)) {
    const relative = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
    const exemptions = lexicon.allowed
      .filter((entry) => entry.files.includes(relative))
      .map((entry) => normalize(entry.phrase));

    for (const raw of collectDisplayableText(file)) {
      let text = normalize(raw);
      for (const phrase of exemptions) text = text.split(phrase).join(' ');

      for (const { id, regex } of patterns) {
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          violations.push({
            file: relative,
            termId: id,
            match: match[0],
            context: text.slice(
              Math.max(0, match.index - 45),
              match.index + match[0].length + 45,
            ),
          });
          if (match[0].length === 0) regex.lastIndex += 1;
        }
      }
    }
  }
  return violations;
}

describe('vocabulaire de la promesse produit (web)', () => {
  it('le lexique est lisible et non vide', () => {
    expect(lexicon.forbidden.length).toBeGreaterThan(0);
    for (const term of lexicon.forbidden) {
      expect(term.why.length).toBeGreaterThan(40);
      expect(() => new RegExp(term.pattern, 'giu')).not.toThrow();
    }
    for (const entry of lexicon.allowed) {
      expect(entry.files.length).toBeGreaterThan(0);
      expect(entry.reason.length).toBeGreaterThan(20);
    }
  });

  it('chaque exemption désigne un fichier qui existe encore', () => {
    // Une exemption qui survit à son fichier est une porte laissée ouverte
    // sur un chemin que plus personne ne relit.
    for (const entry of lexicon.allowed) {
      for (const file of entry.files) {
        expect({ file, exists: fs.existsSync(path.join(REPO_ROOT, file)) }).toEqual(
          { file, exists: true },
        );
      }
    }
  });

  it('le balayage atteint réellement les surfaces marketing', () => {
    // Un scanner qui ne visite rien est vert pour toujours (leçon 28 : un
    // signal que personne ne consomme n'est pas un filet). On exige donc que
    // les fichiers qui portent la promesse soient dans le lot balayé.
    const scanned = collectSourceFiles(SCAN_ROOT).map((f) =>
      path.relative(REPO_ROOT, f).replace(/\\/g, '/'),
    );
    expect(scanned.length).toBeGreaterThan(100);
    for (const expected of [
      'apps/web/src/app/page.tsx',
      'apps/web/src/app/layout.tsx',
      'apps/web/src/app/manifest.ts',
      'apps/web/src/app/cgu/page.tsx',
      'apps/web/src/app/cgv/page.tsx',
      'apps/web/src/lib/calculators.ts',
      'apps/web/src/lib/pricing.ts',
    ]) {
      expect(scanned).toContain(expected);
    }
  });

  it('extrait le texte JSX et pas seulement les littéraux', () => {
    // La promesse la plus exposée du dépôt est un <h1>, donc du JsxText. Si
    // l'extraction se limitait aux chaînes, le garde-fou raterait précisément
    // ce qu'il existe pour surveiller.
    const texts = collectDisplayableText(
      path.join(REPO_ROOT, 'apps/web/src/app/page.tsx'),
    ).map(normalize);
    // Le <h1> de `/` a changé avec la fusion des deux landings (E3-1) : la page
    // d'accueil porte désormais le récit artisan. On asserte la formulation en
    // vigueur **et** l'absence de l'ancienne : une assertion positive seule se
    // recalerait à chaque réécriture sans rien dire, une négative seule
    // deviendrait muette le jour où l'ancienne phrase quitte le dépôt.
    expect(
      texts.some((t) => t.includes('Chiffrez chez le client, pas le soir au bureau')),
    ).toBe(true);
    expect(
      texts.some((t) => t.includes('Chiffrez vos matériaux sur la pièce réelle')),
    ).toBe(false);
  });

  it('aucune chaîne affichable ne promet l’exactitude, l’unicité ou une économie chiffrée', () => {
    const violations = scan();
    const report = violations.map(
      (v) => `${v.file} [${v.termId}] « ${v.match} » — …${v.context}…`,
    );
    expect(report).toEqual([]);
  });

  it('détecte bien une promesse interdite (le garde-fou peut rougir)', () => {
    // Sans cette assertion, un motif cassé rendrait le test précédent vert pour
    // toujours et sans bruit (leçon 21, corollaire : un test qui ne peut pas
    // rougir ne protège rien).
    const samples = [
      'Toisé calcule les quantités exactes à partir de vos mesures.',
      'Estimation de matériaux précise',
      'Le seul outil qui calcule vos quantités',
      'Économisez sur chaque chantier',
      'Arrêtez d’acheter 15 à 25&nbsp;% de matériaux en trop.',
      // E4-4 : seul `hostilite-client` peut attraper celui-ci. Sans cet
      // échantillon, un motif cassé rendrait la règle muette sans bruit.
      'Vérifiez si votre artisan vous arnaque',
    ];
    const patterns = lexicon.forbidden.map(
      (term) => new RegExp(term.pattern, 'giu'),
    );
    for (const sample of samples) {
      const text = normalize(sample);
      expect({
        sample,
        caught: patterns.some((regex) => {
          regex.lastIndex = 0;
          return regex.test(text);
        }),
      }).toEqual({ sample, caught: true });
    }
  });
});
