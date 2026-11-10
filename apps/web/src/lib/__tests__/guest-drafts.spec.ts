/**
 * La forme du brouillon invité, déclarée une seule fois.
 *
 * Défaut d'origine : la forme persistée sous `toise_local_projects` était
 * redéclarée dans chaque écran du parcours (tableau de bord, calculateur public,
 * dimensions, sélection des travaux) et une cinquième fois, en plus court, dans
 * `AuthContext`. Rien ne reliant l'écrivain au lecteur, `work_items` — écrit par
 * l'étape « Sélection des travaux » — manquait à la copie qu'utilisait la
 * migration : TypeScript n'avait aucun moyen de le signaler, et un invité qui
 * s'inscrivait perdait sa sélection d'ouvrages.
 *
 * Ces tests tiennent la condition qui rend TypeScript efficace — une seule
 * déclaration, une seule clé — et l'énumération des champs à l'exécution, sur
 * laquelle s'appuie le test de couverture de la migration.
 */

import { readdirSync, readFileSync } from 'fs';
import { join, relative, sep } from 'path';
import {
  GUEST_DRAFT_FIELDS,
  GUEST_PROJECTS_STORAGE_KEY,
  readGuestDrafts,
  writeGuestDrafts,
  clearGuestDrafts,
} from '../guest-drafts';
import { COMPLETE_GUEST_DRAFT } from './guest-draft.fixture';

const SRC_DIR = join(__dirname, '..', '..');
const DECLARING_MODULE = join('lib', 'guest-drafts.ts');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sourceFiles(full);
    }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('GUEST_DRAFT_FIELDS', () => {
  /**
   * `GUEST_DRAFT_FIELDS` ne peut pas diverger du type : `satisfies` interdit d'y
   * lister un champ inexistant, `AllFieldsListed` d'en oublier un. Reste à
   * arrimer le brouillon de référence — sans quoi il pourrait rester incomplet,
   * et la couverture de la migration ne prouverait plus rien.
   */
  it('énumère exactement les champs du brouillon de référence', () => {
    expect([...GUEST_DRAFT_FIELDS].sort()).toEqual(
      Object.keys(COMPLETE_GUEST_DRAFT).sort(),
    );
  });
});

describe('clé de stockage', () => {
  /**
   * Le test de non-régression du défaut : tant que la clé n'est nommée qu'ici,
   * tout écrivain passe par `GuestProjectDraft`, et un champ écrit sans être
   * déclaré devient une erreur de compilation. Redéclarer la clé ailleurs, c'est
   * rouvrir la porte à un type parallèle — et à un champ perdu en silence.
   */
  it('n’est déclarée que par `lib/guest-drafts.ts`', () => {
    const offenders = sourceFiles(SRC_DIR)
      .filter((file) => !file.endsWith(DECLARING_MODULE))
      .filter((file) => readFileSync(file, 'utf8').includes(GUEST_PROJECTS_STORAGE_KEY))
      .map((file) => relative(SRC_DIR, file).split(sep).join('/'));

    expect(offenders).toEqual([]);
  });
});

describe('readGuestDrafts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('relit ce qui a été écrit', () => {
    writeGuestDrafts([COMPLETE_GUEST_DRAFT]);
    expect(readGuestDrafts()).toEqual([COMPLETE_GUEST_DRAFT]);
  });

  it('rend une liste vide sans rien stocké', () => {
    expect(readGuestDrafts()).toEqual([]);
  });

  /**
   * Une clé illisible ou d'une autre forme (extension, quota, reliquat d'une
   * version antérieure) ne doit jamais faire échouer un écran du parcours :
   * l'invité repartirait sur une page d'erreur pour un brouillon corrompu.
   */
  it.each([
    ['illisible', '{ pas du JSON'],
    ['d’une autre forme', '{"projects":[]}'],
  ])('rend une liste vide sur un contenu %s', (_label, stored) => {
    localStorage.setItem(GUEST_PROJECTS_STORAGE_KEY, stored);
    expect(readGuestDrafts()).toEqual([]);
  });

  it('oublie les brouillons après `clearGuestDrafts`', () => {
    writeGuestDrafts([COMPLETE_GUEST_DRAFT]);
    clearGuestDrafts();
    expect(localStorage.getItem(GUEST_PROJECTS_STORAGE_KEY)).toBeNull();
  });
});
