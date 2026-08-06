import * as fs from 'fs';
import * as path from 'path';

/**
 * Verrou anti-régression sur les fichiers qui produisent le PDF ou l'e-mail
 * envoyés au client final de l'artisan. Ces neuf séquences n'existent en
 * français correct que sous leur forme accentuée ; chacune a déjà fui dans un
 * document réel avant d'être corrigée à la main.
 *
 * Périmètre volontairement restreint aux fichiers PDF/e-mail : l'élargir à
 * `apps/api/src` entier ferait échouer le test sur des usages corrects et hors
 * sujet (commentaires « il s'ajoute à… », « ne renseigne pas » — conjugaisons
 * présentes correctement orthographiées, pas des fautes).
 */
const FORBIDDEN_PATTERNS = [
  'competence',
  'Validite',
  'renseigne',
  'ajoute ', // espace finale : distingue le participe passé fautif du présent correct ("il ajoute")
  'incoherentes',
  'Recapitulatif',
  'adaptes',
  'a la commande',
  'a la reception',
];

const SRC_ROOT = path.join(__dirname, '..');

const SCOPED_FILES = [
  'common/pdf/pdf-builder.ts',
  'quotes/quote-pdf.service.ts',
  'invoices/invoice-pdf.service.ts',
  'shopping-lists/shopping-list-export.service.ts',
  'email/email.service.ts',
  ...fs
    .readdirSync(path.join(SRC_ROOT, 'email/templates'))
    .filter((name) => name.endsWith('.template.ts'))
    .map((name) => `email/templates/${name}`),
];

function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*')
  );
}

describe('aucune chaîne de PDF ou d’e-mail ne contient une séquence désaccentuée connue', () => {
  it('couvre bien la liste attendue de fichiers PDF/e-mail', () => {
    expect(SCOPED_FILES.length).toBeGreaterThanOrEqual(15);
  });

  it('ne laisse passer aucune des séquences fautives listées', () => {
    const offenses: string[] = [];

    for (const relativePath of SCOPED_FILES) {
      const filePath = path.join(SRC_ROOT, relativePath);
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

      lines.forEach((line, index) => {
        if (isCommentLine(line)) return;

        for (const pattern of FORBIDDEN_PATTERNS) {
          if (!line.includes(pattern)) continue;
          offenses.push(`${relativePath}:${index + 1} — « ${pattern} »`);
        }
      });
    }

    expect(offenses).toEqual([]);
  });
});
