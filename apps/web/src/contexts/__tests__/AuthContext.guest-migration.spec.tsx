/**
 * Migration des brouillons invité à la création du compte.
 *
 * Le défaut d'origine : `migrateLocalProjects` rejouait le nom, les dimensions,
 * les décrochés, les exclusions et les ouvertures — **mais pas les
 * `work_items`**. Un invité qui avait choisi ses ouvrages puis s'inscrivait
 * retrouvait une pièce mesurée et vide, à resaisir avant tout chiffrage. Le
 * champ était pourtant écrit par `work-selection/page.tsx` ; c'est la copie du
 * type que lisait la migration qui l'ignorait.
 *
 * Deux tests, deux rôles. Le premier fige le rejeu d'un brouillon complet, appel
 * par appel. Le second en tient la **couverture, champ par champ** : sa table est
 * un `Record<GuestDraftField, …>`, donc exhaustive par construction — ajouter un
 * champ au brouillon sans décider de son sort ne compile plus.
 */

import { render, act } from '@testing-library/react';
import { useEffect } from 'react';
import {
  GUEST_DRAFT_FIELDS,
  GUEST_PROJECTS_STORAGE_KEY,
  writeGuestDrafts,
  type GuestDraftField,
  type GuestProjectDraft,
} from '@/lib/guest-drafts';
import { COMPLETE_GUEST_DRAFT } from '@/lib/__tests__/guest-draft.fixture';
import { useAuth, AuthProvider } from '../AuthContext';

const SERVER_PROJECT_ID = 'srv-project-1';

const onIdTokenChangedMock = jest.fn();
const apiPostMock = jest.fn();
const apiPutMock = jest.fn();

jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: jest.fn(() => ({})) },
  GoogleAuthProvider: jest.fn(),
  OAuthProvider: jest.fn(),
  SAMLAuthProvider: jest.fn(),
  linkWithCredential: jest.fn().mockResolvedValue({}),
  linkWithPopup: jest.fn().mockResolvedValue({}),
  onIdTokenChanged: (...args: unknown[]) => onIdTokenChangedMock(...args),
  sendEmailVerification: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn(),
  signInAnonymously: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({
  getFirebaseAuth: () => ({
    currentUser: { uid: 'guest-1', isAnonymous: true },
  }),
}));

jest.mock('@/lib/api', () => ({
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPut: (...args: unknown[]) => apiPutMock(...args),
  apiDelete: jest.fn(),
}));

/* -------------------------------------------------------------------------- */
/* Relevé des appels                                                          */
/* -------------------------------------------------------------------------- */

interface RecordedCall {
  method: 'POST' | 'PUT';
  path: string;
  body: Record<string, unknown>;
}

function recordedCalls(): RecordedCall[] {
  const from = (
    method: 'POST' | 'PUT',
    mock: jest.Mock,
  ): RecordedCall[] =>
    mock.mock.calls.map(([path, body]) => ({
      method,
      path: path as string,
      body: (body ?? {}) as Record<string, unknown>,
    }));

  return [...from('POST', apiPostMock), ...from('PUT', apiPutMock)];
}

function bodiesOf(
  calls: RecordedCall[],
  method: 'POST' | 'PUT',
  path: string,
): Record<string, unknown>[] {
  return calls
    .filter((call) => call.method === method && call.path === path)
    .map((call) => call.body);
}

function bodyOf(
  calls: RecordedCall[],
  method: 'POST' | 'PUT',
  path: string,
): Record<string, unknown> {
  return bodiesOf(calls, method, path)[0] ?? {};
}

const projectPath = (suffix = '') => `/projects/${SERVER_PROJECT_ID}${suffix}`;

const sameJson = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/* -------------------------------------------------------------------------- */
/* Harnais                                                                    */
/* -------------------------------------------------------------------------- */

interface Observed {
  convertGuestAccount: (email: string, password: string) => Promise<void>;
}

/**
 * Rend le fournisseur, rejoue l'événement d'identité de la session invité, puis
 * convertit le compte — le seul chemin par lequel la migration s'exécute
 * réellement.
 */
async function convertGuestWithDrafts(
  drafts: GuestProjectDraft[],
): Promise<RecordedCall[]> {
  writeGuestDrafts(drafts);

  const observedRef = { current: null as unknown as Observed };

  function Probe() {
    const { convertGuestAccount } = useAuth();
    useEffect(() => {
      observedRef.current = { convertGuestAccount };
    });
    return null;
  }

  let listener: (user: { uid: string } | null) => Promise<void> | void = () =>
    undefined;
  onIdTokenChangedMock.mockImplementation(
    (_auth: unknown, callback: typeof listener) => {
      listener = callback;
      return () => undefined;
    },
  );

  await act(async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });
  await act(async () => {
    await listener({ uid: 'guest-1' });
  });

  // Les appels de la synchronisation initiale ne concernent pas la migration.
  apiPostMock.mockClear();
  apiPutMock.mockClear();

  await act(async () => {
    await observedRef.current.convertGuestAccount('artisan@exemple.fr', 'motdepasse');
  });

  return recordedCalls();
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  apiPostMock.mockImplementation((path: string) =>
    path === '/projects'
      ? Promise.resolve({ id: SERVER_PROJECT_ID })
      : Promise.resolve({}),
  );
  apiPutMock.mockResolvedValue({});
});

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe('migration d’un brouillon complet', () => {
  it('rejoue le projet, ses dimensions, ses ouvertures et ses ouvrages', async () => {
    const calls = await convertGuestWithDrafts([COMPLETE_GUEST_DRAFT]);

    expect(apiPostMock).toHaveBeenCalledWith('/projects', {
      name: 'Rénovation salon',
      room_name: 'Salon',
      work_type: 'painting',
    });

    // Les mètres du brouillon deviennent les centimètres de l'API ; décrochés
    // et exclusions voyagent avec, faute de quoi la surface nette change.
    expect(apiPutMock).toHaveBeenCalledWith(projectPath('/dimensions'), {
      length_cm: 420,
      width_cm: 315,
      height_cm: 250,
      segments: COMPLETE_GUEST_DRAFT.segments,
      exclusions: COMPLETE_GUEST_DRAFT.exclusions,
    });

    expect(bodiesOf(calls, 'POST', projectPath('/openings'))).toEqual([
      { type: 'door', width_cm: 90, height_cm: 210, count: 1 },
      { type: 'window', width_cm: 120, height_cm: 110, count: 2 },
    ]);

    // Le champ perdu : sans lui, l'invité inscrit doit refaire l'étape
    // « Sélection des travaux » avant de pouvoir chiffrer quoi que ce soit.
    expect(apiPostMock).toHaveBeenCalledWith(projectPath('/work-items'), {
      items: COMPLETE_GUEST_DRAFT.work_items,
    });

    expect(localStorage.getItem(GUEST_PROJECTS_STORAGE_KEY)).toBeNull();
  });

  /**
   * `SaveWorkItemsDto` refuse une liste vide (`ArrayMinSize(1)`) : appeler la
   * route pour un brouillon sans ouvrage la ferait répondre 400, et le `catch`
   * de la migration abandonnerait le projet en cours de route.
   */
  it('n’appelle pas la route des ouvrages sans ouvrage à rejouer', async () => {
    const calls = await convertGuestWithDrafts([
      { ...COMPLETE_GUEST_DRAFT, work_items: [] },
    ]);

    expect(bodiesOf(calls, 'POST', projectPath('/work-items'))).toEqual([]);
    expect(bodiesOf(calls, 'POST', '/projects')).toHaveLength(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Couverture champ par champ                                                 */
/* -------------------------------------------------------------------------- */

/** Un champ non rejoué, et la raison — la seule sortie admise de la table. */
interface NotMigrated {
  because: string;
}

type FieldCoverage = ((calls: RecordedCall[]) => boolean) | NotMigrated;

/**
 * Le sort de **chaque** champ du brouillon à la migration.
 *
 * `Record<GuestDraftField, …>` rend la table exhaustive : ajouter un champ à
 * `GuestProjectDraft` sans l'inscrire ici ne compile pas, et l'y inscrire oblige
 * soit à vérifier qu'il est rejoué, soit à écrire pourquoi il ne l'est pas.
 */
const FIELD_COVERAGE: Record<GuestDraftField, FieldCoverage> = {
  id: { because: 'identifiant local du brouillon ; le serveur en émet un autre' },
  updated_at: { because: 'horodatage local ; le serveur date ce qu’il crée' },

  name: (calls) => bodyOf(calls, 'POST', '/projects').name === COMPLETE_GUEST_DRAFT.name,
  room_name: (calls) =>
    bodyOf(calls, 'POST', '/projects').room_name === COMPLETE_GUEST_DRAFT.room_name,
  work_type: (calls) =>
    bodyOf(calls, 'POST', '/projects').work_type === COMPLETE_GUEST_DRAFT.work_type,

  length_m: (calls) =>
    bodyOf(calls, 'PUT', projectPath('/dimensions')).length_cm === 420,
  width_m: (calls) =>
    bodyOf(calls, 'PUT', projectPath('/dimensions')).width_cm === 315,
  height_m: (calls) =>
    bodyOf(calls, 'PUT', projectPath('/dimensions')).height_cm === 250,

  segments: (calls) =>
    sameJson(
      bodyOf(calls, 'PUT', projectPath('/dimensions')).segments,
      COMPLETE_GUEST_DRAFT.segments,
    ),
  exclusions: (calls) =>
    sameJson(
      bodyOf(calls, 'PUT', projectPath('/dimensions')).exclusions,
      COMPLETE_GUEST_DRAFT.exclusions,
    ),

  openings: (calls) =>
    sameJson(
      bodiesOf(calls, 'POST', projectPath('/openings')),
      COMPLETE_GUEST_DRAFT.openings,
    ),

  work_items: (calls) =>
    sameJson(
      bodyOf(calls, 'POST', projectPath('/work-items')).items,
      COMPLETE_GUEST_DRAFT.work_items,
    ),
};

describe('couverture de la migration', () => {
  let calls: RecordedCall[];

  beforeEach(async () => {
    calls = await convertGuestWithDrafts([COMPLETE_GUEST_DRAFT]);
  });

  it.each(GUEST_DRAFT_FIELDS)('rejoue le champ « %s »', (field) => {
    const coverage = FIELD_COVERAGE[field];
    if (typeof coverage !== 'function') {
      expect(coverage.because).not.toHaveLength(0);
      return;
    }
    // Un champ saisi par l'invité et non rejoué est une saisie perdue, en
    // silence, au moment précis où il crée son compte.
    expect({ field, migrated: coverage(calls) }).toEqual({ field, migrated: true });
  });
});
