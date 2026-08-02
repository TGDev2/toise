/**
 * Purge du cache offline au changement d'identité.
 *
 * `logout` vidait déjà les caches, mais rien ne l'impose : sur un appareil
 * partagé, B se connecte le plus souvent par-dessus la session de A sans que
 * personne n'ait cliqué sur « se déconnecter ». La purge doit donc être
 * accrochée au changement d'identité lui-même, seul événement garanti.
 *
 * Le pendant compte aussi : un simple rafraîchissement de jeton (même uid)
 * ne doit rien purger, sinon le cache hors ligne (MOB-1) ne survit jamais
 * assez longtemps pour servir.
 */

import { render, act } from '@testing-library/react';
import { AuthProvider } from '../AuthContext';

const onIdTokenChangedMock = jest.fn();

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
  signInAnonymously: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({ getFirebaseAuth: () => ({}) }));

jest.mock('@/lib/api', () => ({
  apiPost: jest.fn().mockResolvedValue({}),
  apiPut: jest.fn().mockResolvedValue({}),
  apiDelete: jest.fn().mockResolvedValue({}),
}));

type IdentityListener = (user: { uid: string } | null) => Promise<void> | void;

/** Doublure de `CacheStorage` : seuls les noms nous intéressent ici. */
function installCaches(names: string[]): Map<string, true> {
  const store = new Map<string, true>(names.map((name) => [name, true]));
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    writable: true,
    value: {
      keys: async () => [...store.keys()],
      delete: async (name: string) => store.delete(name),
      open: async () => ({ match: async () => undefined }),
      match: async () => undefined,
    },
  });
  return store;
}

async function renderWithIdentity(): Promise<IdentityListener> {
  let listener: IdentityListener = () => undefined;
  onIdTokenChangedMock.mockImplementation((_auth, callback: IdentityListener) => {
    listener = callback;
    return () => undefined;
  });

  await act(async () => {
    render(
      <AuthProvider>
        <div />
      </AuthProvider>,
    );
  });

  return (user) => act(async () => {
    await listener(user);
  });
}

/** Ce que l'appareil a retenu de la session précédente (survit à l'onglet fermé). */
const LAST_IDENTITY_KEY = 'chiffreo_last_uid';

describe('AuthContext — cache offline et changement de compte', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it("purge les caches quand une autre identité prend la place, sans déconnexion", async () => {
    localStorage.setItem(LAST_IDENTITY_KEY, 'uid-a');
    const store = installCaches([
      'chiffreo-pages-v1',
      'chiffreo-api-v1-uid-a',
      'chiffreo-static-v1',
    ]);
    const emit = await renderWithIdentity();

    await emit({ uid: 'uid-b' });

    expect(store.has('chiffreo-api-v1-uid-a')).toBe(false);
    expect(store.has('chiffreo-pages-v1')).toBe(false);
    // Coquille et assets statiques : aucune donnée de compte, rien à purger.
    expect(store.has('chiffreo-static-v1')).toBe(true);
  });

  it('ne purge rien lors du simple rafraîchissement du jeton du même compte', async () => {
    localStorage.setItem(LAST_IDENTITY_KEY, 'uid-a');
    const store = installCaches(['chiffreo-pages-v1', 'chiffreo-api-v1-uid-a']);
    const emit = await renderWithIdentity();

    await emit({ uid: 'uid-a' });
    await emit({ uid: 'uid-a' });

    expect(store.has('chiffreo-api-v1-uid-a')).toBe(true);
    expect(store.has('chiffreo-pages-v1')).toBe(true);
  });

  it("purge les caches laissés par une identité que l'appareil ne connaît plus", async () => {
    // Caches antérieurs au suivi d'identité, ou mémoire effacée : rien ne dit qu'ils
    // appartiennent à l'arrivant.
    const store = installCaches(['chiffreo-pages-v1', 'chiffreo-api-v1-uid-a']);
    const emit = await renderWithIdentity();

    await emit({ uid: 'uid-b' });

    expect(store.has('chiffreo-api-v1-uid-a')).toBe(false);
    expect(store.has('chiffreo-pages-v1')).toBe(false);
  });

  it('purge à la déconnexion et retient qu’aucune identité n’est en place', async () => {
    localStorage.setItem(LAST_IDENTITY_KEY, 'uid-a');
    const store = installCaches(['chiffreo-pages-v1', 'chiffreo-api-v1-uid-a']);
    const emit = await renderWithIdentity();

    await emit(null);

    expect(store.has('chiffreo-api-v1-uid-a')).toBe(false);
    expect(localStorage.getItem(LAST_IDENTITY_KEY)).toBeNull();
  });
});
