import * as fs from 'fs';
import * as path from 'path';

/**
 * Verrou anti-régression : ces neuf séquences n'existent en français correct
 * que sous leur forme accentuée. Chacune a déjà fui dans une chaîne affichée
 * (devis PDF compris) avant d'être corrigée à la main.
 */
const FORBIDDEN_PATTERNS = [
  'competence',
  'Validite',
  'renseigne',
  'ajoute ', // espace finale : distingue le participe passé fautif ("pas ajoute de portes") du présent correct ("il ajoute")
  'incoherentes',
  'Recapitulatif',
  'adaptes',
  'a la commande',
  'a la reception',
];

/**
 * Occurrences confirmées correctes qui contiennent malgré tout l'une des
 * séquences ci-dessus — pas des fautes à corriger, donc pas de motif plus
 * permissif qui rouvrirait la porte à un vrai bug.
 */
const ALLOWLIST: Array<{ file: string; pattern: string; reason: string }> = [
  {
    file: 'app/pricing/page.tsx',
    pattern: 'ajoute ',
    reason: '« L’offre payante ajoute ce dont... » : présent correct de « ajouter », pas un participe passé fautif',
  },
  {
    // Le récit artisan vivait sur `app/artisans/page.tsx` jusqu'à E3-1 ; il est
    // désormais la page d'accueil. Une exemption qui pointe un fichier disparu
    // ne rougit pas : elle cesse simplement de couvrir la ligne qu'elle
    // couvrait, et c'est le scan qui rougit — d'où le recalage sur le nouveau
    // chemin plutôt qu'une suppression.
    file: 'app/page.tsx',
    pattern: 'renseigne',
    reason: '« renseignez votre profil » : impératif correct, contient la sous-chaîne sans être fautif',
  },
];

const SRC_ROOT = path.join(__dirname, '..');
const SELF_PATH = path.join(__dirname, 'no-desaccentuated-strings.spec.ts');

function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*')
  );
}

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && fullPath !== SELF_PATH) {
      out.push(fullPath);
    }
  }
  return out;
}

describe('aucune chaîne affichée ne contient une séquence désaccentuée connue', () => {
  const files = collectSourceFiles(SRC_ROOT);

  it('parcourt bien des fichiers sources (garde-fou contre un scan vide)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('ne garde aucune exemption pointant un fichier disparu', () => {
    // Une exemption périmée n'échoue jamais : elle cesse juste de couvrir quoi
    // que ce soit. On ne saurait plus, en la lisant, si elle protège encore une
    // formulation correcte ou si elle a survécu à un déplacement de fichier —
    // exactement ce qui est arrivé à `app/artisans/page.tsx` en E3-1.
    const stale = ALLOWLIST.filter(
      (entry) => !fs.existsSync(path.join(SRC_ROOT, entry.file)),
    ).map((entry) => entry.file);

    expect(stale).toEqual([]);
  });

  it('ne laisse passer aucune des séquences fautives listées', () => {
    const offenses: string[] = [];

    for (const filePath of files) {
      const relativePath = path
        .relative(SRC_ROOT, filePath)
        .split(path.sep)
        .join('/');
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

      lines.forEach((line, index) => {
        if (isCommentLine(line)) return;

        for (const pattern of FORBIDDEN_PATTERNS) {
          if (!line.includes(pattern)) continue;
          const allowed = ALLOWLIST.some(
            (entry) => entry.file === relativePath && entry.pattern === pattern,
          );
          if (allowed) continue;
          offenses.push(`${relativePath}:${index + 1} — « ${pattern} »`);
        }
      });
    }

    expect(offenses).toEqual([]);
  });
});
