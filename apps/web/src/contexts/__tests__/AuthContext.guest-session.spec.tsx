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
 */

import { render, act } from '@testing-library/react';
import { useEffect } from 'react';
import { useAuth, AuthProvider } from '../AuthContext';

const onIdTokenChangedMock = jest.fn();
const signInAnonymouslyMock = jest.fn();

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
  apiPost: jest.fn().mockResolvedValue({}),
  apiPut: jest.fn().mockResolvedValue({}),
  apiDelete: jest.fn().mockResolvedValue({}),
}));

interface Observed {
  startGuestSession: () => Promise<void>;
  isLoading: boolean;
}

type IdentityListener = (user: { uid: string } | null) => Promise<void> | void;

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

  let listener: IdentityListener = () => undefined;
  onIdTokenChangedMock.mockImplementation(
    (_auth: unknown, callback: IdentityListener) => {
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

  const notifyIdentity: IdentityListener = (user) =>
    act(async () => {
      await listener(user);
    });

  // Aucune session : Firebase le signale, `isLoading` retombe.
  await notifyIdentity(null);

  return { auth: observedRef, notifyIdentity };
}

describe('startGuestSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.cookie = 'chiffreo_auth=; path=/; max-age=0';
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
