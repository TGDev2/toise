import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * Pendant côté API du garde-fou de la promesse produit (E2-3).
 *
 * Le lexique est celui de `docs/promesse-lexique.json`, partagé avec le web :
 * la liste des termes est ce qui change, et deux copies auraient divergé. Le
 * mécanisme de balayage, lui, est répété ici parce que les deux paquets ont des
 * configurations Jest disjointes (`rootDir: "src"` côté API) et qu'un import
 * hors racine n'y est pas transformé.
 *
 * Périmètre : tout `apps/api/src`, y compris les migrations — elles portent les
 * `description_fr` des feature gates, qui sont affichées telles quelles. Le
 * balayage passe par l'AST, donc les commentaires et les messages d'exception
 * techniques ne sont pas concernés ; seuls le sont les littéraux, les gabarits
 * et le texte JSX.
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

/** L'ancre est le lexique lui-même : `apps/web` porte un `pnpm-workspace.yaml`
 * propre, qui ferait s'arrêter la remontée sur le mauvais dossier. */
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
const SCAN_ROOT = path.join(REPO_ROOT, 'apps', 'api', 'src');

const lexicon = JSON.parse(fs.readFileSync(LEXICON_PATH, 'utf8')) as Lexicon;

const EXCLUDED =
  /(__tests__|__mocks__|\.spec\.ts$|\.e2e-spec\.ts$|\.int-spec\.ts$|-harness\.ts$)/;

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      collectSourceFiles(full, out);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (EXCLUDED.test(full.replace(/\\/g, '/'))) continue;
    out.push(full);
  }
  return out;
}

function normalize(text: string): string {
  return text
    .replace(/[‘’ʼ]/g, "'")
    .replace(/&nbsp;| | /g, ' ')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

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

describe('vocabulaire de la promesse produit (api)', () => {
  it('le balayage atteint réellement les libellés destinés à un humain', () => {
    // Sans cette assertion, une erreur de chemin ou un motif d'exclusion trop
    // large rendrait la suite verte en ne visitant aucun fichier.
    const scanned = collectSourceFiles(SCAN_ROOT).map((f) =>
      path.relative(REPO_ROOT, f).replace(/\\/g, '/'),
    );
    expect(scanned.length).toBeGreaterThan(100);
    for (const expected of [
      'apps/api/src/email/templates/onboarding-d3.template.ts',
      'apps/api/src/email/templates/project-abandoned.template.ts',
      'apps/api/src/quotes/quote-pdf.service.ts',
      'apps/api/src/estimations/material-justification.ts',
      'apps/api/src/materials/seed-catalog.data.ts',
    ]) {
      expect(scanned).toContain(expected);
    }
  });

  it('aucun libellé généré ne promet l’exactitude, l’unicité ou une économie chiffrée', () => {
    const violations = scan();
    const report = violations.map(
      (v) => `${v.file} [${v.termId}] « ${v.match} » — …${v.context}…`,
    );
    expect(report).toEqual([]);
  });

  it('détecte bien une promesse interdite (le garde-fou peut rougir)', () => {
    const samples = [
      "Il ne reste qu'une étape pour connaître le budget exact.",
      'Des quantités précises pour votre chantier',
      'Le seul logiciel qui chiffre vos matériaux',
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
