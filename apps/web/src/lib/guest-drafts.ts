import type { Opening, RectSegment, SurfaceExclusion } from './surface';
import type { WorkItemSelection } from './work-types';

/**
 * Brouillons de projet du parcours invité, en `localStorage`.
 *
 * Un invité n'a pas de compte : tant qu'il n'en crée pas un, ses projets ne
 * vivent que dans ce navigateur. `migrateLocalProjects` (AuthContext) les rejoue
 * vers l'API à l'inscription, puis vide la clé.
 */
export const GUEST_PROJECTS_STORAGE_KEY = 'chiffreo_local_projects';

/** Métier du brouillon — étiqueté par `WORK_TYPE_LABELS`. */
export type GuestWorkType = 'painting' | 'tiling' | 'flooring' | 'partition';

/**
 * **Forme unique du brouillon invité — écrivains et migration compris.**
 *
 * Ce type était auparavant redéclaré dans chaque écran du parcours (tableau de
 * bord, calculateur public, dimensions, sélection des travaux) et une cinquième
 * fois, en plus court, dans `AuthContext`. Rien ne reliant l'écrivain au
 * lecteur, `work_items` — écrit par l'étape « Sélection des travaux » — était
 * absent de la copie que lisait la migration : TypeScript n'avait aucun moyen de
 * le signaler, et un invité qui s'inscrivait perdait ses ouvrages.
 *
 * Le remède est structurel : une seule déclaration. Un champ écrit par un écran
 * sans être déclaré ici devient une erreur de compilation à l'écriture, et le
 * test de couverture de `guest-drafts.spec.ts` échoue tant que la migration ne
 * le porte pas.
 */
export interface GuestProjectDraft {
  id: string;
  name: string;
  room_name: string;
  work_type: GuestWorkType;
  length_m?: number;
  width_m?: number;
  height_m?: number;
  openings?: Opening[];
  /**
   * Décrochés et zones exclues saisis en mode invité (GTM-9) : ils décident de
   * la surface nette, donc du chiffrage.
   */
  segments?: RectSegment[];
  exclusions?: SurfaceExclusion[];
  /** Ouvrages retenus à l'étape « Sélection des travaux ». */
  work_items?: WorkItemSelection[];
  updated_at: string;
}

export type GuestDraftField = keyof GuestProjectDraft;

/**
 * Les champs du brouillon, à l'exécution — ce qu'un test peut énumérer, là où le
 * type est effacé à la compilation.
 *
 * `satisfies` interdit d'y lister un champ inexistant ; `AllFieldsListed`
 * ci-dessous interdit d'en oublier un. La liste ne peut donc pas diverger du
 * type, dans un sens comme dans l'autre.
 */
export const GUEST_DRAFT_FIELDS = [
  'id',
  'name',
  'room_name',
  'work_type',
  'length_m',
  'width_m',
  'height_m',
  'openings',
  'segments',
  'exclusions',
  'work_items',
  'updated_at',
] as const satisfies readonly GuestDraftField[];

type AssertNever<T extends never> = T;

/** Erreur de compilation si un champ du type manque à `GUEST_DRAFT_FIELDS`. */
export type AllFieldsListed = AssertNever<
  Exclude<GuestDraftField, (typeof GUEST_DRAFT_FIELDS)[number]>
>;

/**
 * Lit les brouillons. Un contenu illisible ou d'une autre forme (clé écrasée par
 * une extension, quota, navigation privée) ne doit jamais faire échouer un écran
 * du parcours : on repart d'une liste vide.
 */
export function readGuestDrafts(): GuestProjectDraft[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GUEST_PROJECTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeGuestDrafts(drafts: GuestProjectDraft[]): void {
  localStorage.setItem(GUEST_PROJECTS_STORAGE_KEY, JSON.stringify(drafts));
}

export function clearGuestDrafts(): void {
  localStorage.removeItem(GUEST_PROJECTS_STORAGE_KEY);
}
