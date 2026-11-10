import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * Garde-fou du nom commercial du palier payant (BACKLOG_V1, « un nom, partout »).
 *
 * Le lexique vit dans `docs/plan-naming-lexicon.json`, partagé avec l'API — même
 * raison qu'un lexique partagé ailleurs dans ce dépôt (`promesse-lexique.json`) :
 * deux listes concurrentes finiraient par diverger.
 *
 * Comme `promise-wording.spec.ts`, le scan passe par l'AST TypeScript (littéraux
 * de chaîne, gabarits, texte JSX) et non par une regex sur le fichier brut : les
 * commentaires — qui emploient légitimement « Contractor Premium » ou « artisan »
 * en toutes lettres pour décrire l'historique ou le métier — n'atteignent jamais
 * un écran et ne sont donc jamais visités.
 */

interface ForbiddenTerm {
  id: string;
  pattern: string;
  flags: string;
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

const LEXICON_RELATIVE = path.join('docs', 'plan-naming-lexicon.json');

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
    regex: new RegExp(term.pattern, term.flags),
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

describe('nom commercial du palier payant (web)', () => {
  it('le lexique est lisible et non vide', () => {
    expect(lexicon.forbidden.length).toBeGreaterThan(0);
    for (const term of lexicon.forbidden) {
      expect(term.why.length).toBeGreaterThan(40);
      expect(() => new RegExp(term.pattern, term.flags)).not.toThrow();
    }
    for (const entry of lexicon.allowed) {
      expect(entry.files.length).toBeGreaterThan(0);
      expect(entry.reason.length).toBeGreaterThan(20);
    }
  });

  it('ne garde aucune exemption pointant un fichier disparu', () => {
    const stale = lexicon.allowed
      .flatMap((entry) => entry.files)
      .filter((file) => !fs.existsSync(path.join(REPO_ROOT, file)));

    expect(stale).toEqual([]);
  });

  it('le balayage atteint bien les surfaces qui affichent le nom du palier', () => {
    const scanned = collectSourceFiles(SCAN_ROOT).map((f) =>
      path.relative(REPO_ROOT, f).replace(/\\/g, '/'),
    );
    expect(scanned.length).toBeGreaterThan(100);
    for (const expected of [
      'apps/web/src/lib/pricing.ts',
      'apps/web/src/app/pricing/page.tsx',
      'apps/web/src/components/paywall/ContractorPricingModal.tsx',
      'apps/web/src/components/dashboard/ContractorDashboard.tsx',
      'apps/web/src/app/(app)/dashboard/page.tsx',
      'apps/web/src/app/cgv/page.tsx',
      'apps/web/src/app/(admin)/admin/analytics/page.tsx',
    ]) {
      expect(scanned).toContain(expected);
    }
  });

  it('aucune chaîne affichée ne nomme le palier payant autrement que « Toisé Pro »', () => {
    const violations = scan();
    const report = violations.map(
      (v) => `${v.file} [${v.termId}] « ${v.match} » — …${v.context}…`,
    );
    expect(report).toEqual([]);
  });

  it('détecte bien un nom de palier interdit (le garde-fou peut rougir)', () => {
    const samples = [
      'Plan Contractor',
      'Offre ESSENTIEL',
      'Artisan à 19 €/mois',
    ];
    const patterns = lexicon.forbidden.map(
      (term) => new RegExp(term.pattern, term.flags),
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

  it('ne rougit pas sur les identifiants techniques ni sur « artisan » employé comme nom commun', () => {
    const samples = [
      "contractor_essentiel",
      "stripe.contractorEssentielPriceId",
      "ContractorDashboard",
      "isContractor",
      "cet artisan mesure sa pièce avant de chiffrer",
    ];
    const patterns = lexicon.forbidden.map(
      (term) => new RegExp(term.pattern, term.flags),
    );
    for (const sample of samples) {
      const text = normalize(sample);
      expect({
        sample,
        caught: patterns.some((regex) => {
          regex.lastIndex = 0;
          return regex.test(text);
        }),
      }).toEqual({ sample, caught: false });
    }
  });
});
