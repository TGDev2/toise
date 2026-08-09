/**
 * Ouverture d'une session invité (E2-1).
 *
 * Le défaut d'origine, observé en navigateur : cliquer sur « Essayer sans
 * compte » renvoyait vers `/login`. `signInAnonymously` résout dès que Firebase
 * a émis le jeton, mais l'appelant navigue *immédiatement* vers `/dashboard`,
 * alors que ni le marqueur de session lu par `proxy.ts`, ni `appUser`, ni même
 * `isGuest` n'existent encore — tout cela n'arrive qu'au tour suivant, via
 * `onIdTokenChanged`. Deux gardes, l'une serveur et l'autre client, voyaient
 * donc un visiteur sans session et l'éjectaient sans un mot.
 *
 * Ces tests figent les deux moitiés du correctif — le marqueur de session et le
 * réarmement de `isLoading`. Ils portent sur ce que `startGuestSession` **a déjà
 * publié quand sa promesse résout** : c'est le seul instant que l'appelant peut
 * observer avant de naviguer.
 *
 * ---
 *
 * **Adoption des brouillons locaux** — deuxième cause du cul-de-sac du parcours
 * d'acquisition.
 *
 * Le calculateur public écrit un brouillon en `localStorage` puis ouvre une
 * session invité. Or `migrateLocalProjects` n'était rejouée que par les trois
 * voies de conversion : le brouillon n'atteignait jamais l'API. Comme un invité
 * a malgré tout un `appUser` (`onIdTokenChanged` synchronise aussi les comptes
 * anonymes), l'écran suivant demandait `/projects/<uuid-local>` et récoltait un
 * 404.
 *
 * Les tests ci-dessous portent sur ce que `startGuestSession` garantit
 * désormais, dans l'ordre où elle doit le garantir — la synchronisation d'abord,
 * parce que `resolveForFirebaseUid` refuse tant qu'aucune ligne `users` ne porte
 * l'uid, et la migration ensuite.
 */

import { render, act } from '@testing-library/react';
import { useEffect } from 'react';
import {
  GUEST_PROJECTS_STORAGE_KEY,
  readGuestDrafts,
  writeGuestDrafts,
  type GuestProjectDraft,
} from '@/lib/guest-drafts';
import { useAuth, AuthProvider, type GuestDraftMigration } from '../AuthContext';

const onIdTokenChangedMock = jest.fn();
const signInAnonymouslyMock = jest.fn();
const apiPostMock = jest.fn();
const apiPutMock = jest.fn();
const apiDeleteMock = jest.fn();

jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: jest.fn() },
  GoogleAuthProvider: jest.fn(),
  OAuthProvider: jest.fn(),
  SAMLAuthProvider: jest.fn(),
  linkWithCredential: jest.fn(),
  linkWithPopup: jest.fn(),
  onIdTokenChanged: (...args: unknown[]) => onIdTokenChangedMock(...args),
  sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signInAnonymously: (...args: unknown[]) => signInAnonymouslyMock(...args),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({ getFirebaseAuth: () => ({}) }));

jest.mock('@/lib/api', () => ({
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPut: (...args: unknown[]) => apiPutMock(...args),
  apiDelete: (...args: unknown[]) => apiDeleteMock(...args),
}));

const SERVER_PROJECT_ID = 'srv-project-1';

const DRAFT: GuestProjectDraft = {
  id: 'local-uuid-1',
  name: 'Mon projet peinture',
  room_name: 'Ma pièce',
  work_type: 'painting',
  length_m: 4,
  width_m: 3,
  height_m: 2.5,
  openings: [{ type: 'door', width_cm: 90, height_cm: 210, count: 1 }],
  updated_at: '2026-08-09T10:00:00.000Z',
};

/** Chemins postés, dans l'ordre — l'ordre *est* ce que ces tests vérifient. */
const postedPaths = (): string[] =>
  apiPostMock.mock.calls.map(([path]) => path as string);

interface Observed {
  startGuestSession: () => Promise<GuestDraftMigration>;
  isLoading: boolean;
}

type IdentityListener = (user: { uid: string } | null) => Promise<void> | void;

/**
 * L'observateur de jeton installé par le fournisseur, à la disposition des
 * tests : c'est en le déclenchant **depuis** `signInAnonymously`, comme le fait
 * Firebase, qu'on reproduit la course entre les deux `POST /auth/sync`.
 */
let identityListener: IdentityListener = () => undefined;

/**
 * Rend le fournisseur **et rejoue le premier `onIdTokenChanged`, celui qui
 * constate l'absence de session**.
 *
 * Sans cette étape, `isLoading` vaudrait encore `true` par son état initial et
 * le test du drapeau serait vert sans rien démontrer : c'est précisément parce
 * que ce premier événement l'a fait retomber à `false` que la fenêtre
 * d'éjection existe. On part donc de l'état réel d'un visiteur sur la page
 * d'accueil, pas d'un montage qui n'a encore rien appris.
 */
async function renderAuth(): Promise<{
  auth: { current: Observed };
  notifyIdentity: IdentityListener;
}> {
  const observedRef = { current: null as unknown as Observed };

  // Relevé dans un effet, jamais pendant le rendu : muter une variable
  // extérieure en phase de rendu casse l'idempotence que React suppose (et que
  // `react-hooks/immutability` fait respecter). Les effets étant vidés par
  // `act`, le relevé est à jour à chaque assertion.
  function Probe() {
    const { startGuestSession, isLoading } = useAuth();
    useEffect(() => {
      observedRef.current = { startGuestSession, isLoading };
    });
    return null;
  }

  onIdTokenChangedMock.mockImplementation(
    (_auth: unknown, callback: IdentityListener) => {
      identityListener = callback;
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

  const notifyIdentity: IdentityListener = (user) =>
    act(async () => {
      await identityListener(user);
    });

  // Aucune session : Firebase le signale, `isLoading` retombe.
  await notifyIdentity(null);

  return { auth: observedRef, notifyIdentity };
}

describe('startGuestSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    document.cookie = 'chiffreo_auth=; path=/; max-age=0';
    identityListener = () => undefined;
    apiPostMock.mockImplementation((path: string) =>
      path === '/projects'
        ? Promise.resolve({ id: SERVER_PROJECT_ID })
        : Promise.resolve({}),
    );
    apiPutMock.mockResolvedValue({});
    apiDeleteMock.mockResolvedValue(undefined);
  });

  it('pose le marqueur de session avant de rendre la main', async () => {
    signInAnonymouslyMock.mockResolvedValue({ user: { uid: 'guest-1' } });
    const { auth } = await renderAuth();

    expect(document.cookie).not.toContain('chiffreo_auth=1');

    await act(async () => {
      await auth.current.startGuestSession();
    });

    // `proxy.ts` redirige vers /login toute requête `/dashboard` ou
    // `/projects/*` sans ce cookie : l'attendre de `onIdTokenChanged` revenait
    // à parier sur un ordonnancement que rien ne garantit.
    expect(document.cookie).toContain('chiffreo_auth=1');
  });

  it('réarme `isLoading` tant que la session n’est pas établie', async () => {
    signInAnonymouslyMock.mockResolvedValue({ user: { uid: 'guest-1' } });
    const { auth, notifyIdentity } = await renderAuth();

    // Point de départ réel : un visiteur sur la page d'accueil, chargement
    // terminé, aucune session.
    expect(auth.current.isLoading).toBe(false);

    await act(async () => {
      await auth.current.startGuestSession();
    });

    // Réarmé : les gardes des écrans (`!appUser && !isGuest`) doivent voir
    // `isLoading` pour ne pas conclure à l'absence de session pendant que
    // `POST /auth/sync` est encore en vol.
    expect(auth.current.isLoading).toBe(true);

    // Et il retombe une fois la session vraiment établie.
    await notifyIdentity({ uid: 'guest-1' });
    expect(auth.current.isLoading).toBe(false);
  });

  /**
   * Sans jeton émis, aucun `onIdTokenChanged` ne viendra abaisser le drapeau :
   * l'oublier laisserait l'application sur son écran de chargement, pour de bon.
   */
  it('rend la main et relaie l’erreur si Firebase refuse', async () => {
    signInAnonymouslyMock.mockRejectedValue(new Error('auth/network-error'));
    const { auth } = await renderAuth();

    await act(async () => {
      await expect(auth.current.startGuestSession()).rejects.toThrow(
        'auth/network-error',
      );
    });

    expect(auth.current.isLoading).toBe(false);
    expect(document.cookie).not.toContain('chiffreo_auth=1');
  });
});

/* -------------------------------------------------------------------------- */
/* Adoption des brouillons locaux                                             */
/* -------------------------------------------------------------------------- */

describe('startGuestSession — adoption des brouillons locaux', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    document.cookie = 'chiffreo_auth=; path=/; max-age=0';
    identityListener = () => undefined;
    signInAnonymouslyMock.mockResolvedValue({ user: { uid: 'guest-1' } });
    apiPostMock.mockImplementation((path: string) =>
      path === '/projects'
        ? Promise.resolve({ id: SERVER_PROJECT_ID })
        : Promise.resolve({}),
    );
    apiPutMock.mockResolvedValue({});
    apiDeleteMock.mockResolvedValue(undefined);
  });

  async function openGuestSession(): Promise<GuestDraftMigration> {
    const { auth } = await renderAuth();
    let migration!: GuestDraftMigration;
    await act(async () => {
      migration = await auth.current.startGuestSession();
    });
    return migration;
  }

  /**
   * L'ordre n'est pas un détail de style : `OrgContextService.resolveForFirebaseUid`
   * répond `NotFound` — donc 401 sur `POST /projects` — tant que
   * `POST /auth/sync` n'a pas créé la ligne `users`. Migrer d'abord reviendrait
   * à poster le brouillon sur un compte qui n'existe pas encore.
   */
  it('synchronise le compte avant de poster le premier projet', async () => {
    writeGuestDrafts([DRAFT]);

    await openGuestSession();

    const paths = postedPaths();
    expect(paths[0]).toBe('/auth/sync');
    expect(paths).toContain('/projects');
    expect(paths.indexOf('/auth/sync')).toBeLessThan(paths.indexOf('/projects'));
  });

  /**
   * `onIdTokenChanged` synchronise de son côté, et `startGuestSession` doit
   * attendre cette synchronisation : les deux partent donc en même temps sur un
   * uid neuf. `upsertFromFirebase` lit puis écrit sans verrou — deux `INSERT`
   * concurrents sur le même `firebase_uid` violent l'unicité, et l'un des deux
   * ressort en 500. Ici, Firebase notifie depuis `signInAnonymously`, comme en
   * vrai.
   */
  it('ne lance qu’une synchronisation quand l’observateur de jeton part en même temps', async () => {
    signInAnonymouslyMock.mockImplementation(async () => {
      void identityListener({ uid: 'guest-1' });
      return { user: { uid: 'guest-1' } };
    });

    await openGuestSession();

    expect(postedPaths().filter((path) => path === '/auth/sync')).toHaveLength(1);
  });

  it('rejoue le brouillon vers l’API et vide la clé locale', async () => {
    writeGuestDrafts([DRAFT]);

    const migration = await openGuestSession();

    expect(apiPostMock).toHaveBeenCalledWith('/projects', {
      name: 'Mon projet peinture',
      room_name: 'Ma pièce',
      work_type: 'painting',
    });
    expect(apiPutMock).toHaveBeenCalledWith(
      `/projects/${SERVER_PROJECT_ID}/dimensions`,
      {
        length_cm: 400,
        width_cm: 300,
        height_cm: 250,
        segments: undefined,
        exclusions: undefined,
      },
    );
    expect(apiPostMock).toHaveBeenCalledWith(
      `/projects/${SERVER_PROJECT_ID}/openings`,
      { type: 'door', width_cm: 90, height_cm: 210, count: 1 },
    );

    // Ce que l'appelant lit pour décider s'il peut naviguer.
    expect(migration).toEqual({ migrated: [SERVER_PROJECT_ID], failed: [] });
    expect(localStorage.getItem(GUEST_PROJECTS_STORAGE_KEY)).toBeNull();
  });

  /**
   * Le `clearGuestDrafts()` inconditionnel qui terminait la migration effaçait
   * aussi ce qui venait d'échouer : une API injoignable ne coûtait pas un
   * retard, elle coûtait la saisie, à l'instant précis où l'utilisateur croyait
   * sauvegarder.
   */
  it('conserve le brouillon et le signale quand la création du projet échoue', async () => {
    writeGuestDrafts([DRAFT]);
    apiPostMock.mockImplementation((path: string) =>
      path === '/projects'
        ? Promise.reject(new Error('Service indisponible'))
        : Promise.resolve({}),
    );
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const migration = await openGuestSession();

    expect(migration.migrated).toEqual([]);
    expect(migration.failed).toEqual([DRAFT]);
    expect(readGuestDrafts()).toEqual([DRAFT]);
  });

  /**
   * Le projet créé est le point de bascule : le laisser derrière une étape
   * échouée ferait qu'un nouvel essai crée un doublon — et se heurte au quota
   * invité d'un projet, c'est-à-dire à un `ACCOUNT_REQUIRED` qui ne parlerait de
   * rien.
   */
  it('supprime le projet à demi créé avant de rendre le brouillon', async () => {
    writeGuestDrafts([DRAFT]);
    apiPutMock.mockRejectedValue(new Error('422'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const migration = await openGuestSession();

    expect(apiDeleteMock).toHaveBeenCalledWith(`/projects/${SERVER_PROJECT_ID}`);
    expect(migration.failed).toEqual([DRAFT]);
    expect(readGuestDrafts()).toEqual([DRAFT]);
  });

  it('n’appelle aucune route de projet quand il n’y a rien à migrer', async () => {
    const migration = await openGuestSession();

    expect(postedPaths()).toEqual(['/auth/sync']);
    expect(migration).toEqual({ migrated: [], failed: [] });
  });
});
