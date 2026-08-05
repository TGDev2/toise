/**
 * Repli de conversion invité — la preuve de possession envoyée à l'API (E6-3).
 *
 * `/auth/merge-guest` n'est appelé que sur **un seul** chemin : celui où
 * `linkWithCredential`/`linkWithPopup` a échoué en `auth/credential-already-in-use`,
 * c'est-à-dire quand l'identifiant saisi appartient déjà à un compte. Les deux
 * comptes restent alors deux principals Firebase distincts, et rien dans la
 * requête ne prouvait que l'appelant possédait la session invité : le corps ne
 * portait que son **UID**, un identifiant public. N'importe quel compte
 * authentifié pouvait ainsi désigner l'invité d'un tiers, récupérer ses projets
 * et faire supprimer son compte.
 *
 * Ce que ces tests figent :
 *   1. le corps porte le **jeton** de l'invité, pas son UID ;
 *   2. ce jeton est émis **avant** la reconnexion — après, `currentUser` a
 *      changé et il n'est plus émettable ;
 *   3. le chemin nominal (lien réussi) n'appelle toujours pas l'endpoint.
 */

import { render, act } from '@testing-library/react';
import { useEffect } from 'react';
import { useAuth, AuthProvider } from '../AuthContext';

const GUEST_ID_TOKEN = 'guest-id-token';

/** Journal ordonné des gestes d'authentification, pour prouver l'ordre. */
let sequence: string[] = [];

const onIdTokenChangedMock = jest.fn();
const apiPostMock = jest.fn();
const linkWithCredentialMock = jest.fn();
const linkWithPopupMock = jest.fn();
const signInWithEmailAndPasswordMock = jest.fn();
const signInWithPopupMock = jest.fn();

const guestUser = {
  uid: 'guest-1',
  isAnonymous: true,
  getIdToken: jest.fn(async () => {
    sequence.push('getIdToken');
    return GUEST_ID_TOKEN;
  }),
};

jest.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: jest.fn(() => ({})) },
  GoogleAuthProvider: jest.fn(),
  OAuthProvider: jest.fn(),
  linkWithCredential: (...args: unknown[]) => linkWithCredentialMock(...args),
  linkWithPopup: (...args: unknown[]) => linkWithPopupMock(...args),
  onIdTokenChanged: (...args: unknown[]) => onIdTokenChangedMock(...args),
  sendEmailVerification: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn(),
  signInAnonymously: jest.fn(),
  signInWithEmailAndPassword: (...args: unknown[]) =>
    signInWithEmailAndPasswordMock(...args),
  signInWithPopup: (...args: unknown[]) => signInWithPopupMock(...args),
  signOut: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({
  getFirebaseAuth: () => ({ currentUser: guestUser }),
}));

jest.mock('@/lib/api', () => ({
  apiPost: (...args: unknown[]) => apiPostMock(...args),
  apiPut: jest.fn(),
  apiDelete: jest.fn(),
}));

/** Les deux échecs Firebase qui signifient « cet identifiant est déjà pris ». */
function alreadyInUse(code: string): Error {
  return Object.assign(new Error(code), { code });
}

const CREDENTIAL_ALREADY_IN_USE = 'auth/credential-already-in-use';
const EMAIL_ALREADY_IN_USE = 'auth/email-already-in-use';

/* -------------------------------------------------------------------------- */
/* Harnais                                                                    */
/* -------------------------------------------------------------------------- */

interface Observed {
  convertGuestAccount: (email: string, password: string) => Promise<void>;
  convertGuestWithGoogle: () => Promise<void>;
  convertGuestWithApple: () => Promise<void>;
}

async function mountAuth(): Promise<Observed> {
  const observedRef = { current: null as unknown as Observed };

  function Probe() {
    const { convertGuestAccount, convertGuestWithGoogle, convertGuestWithApple } =
      useAuth();
    useEffect(() => {
      observedRef.current = {
        convertGuestAccount,
        convertGuestWithGoogle,
        convertGuestWithApple,
      };
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

  // La synchronisation initiale ne concerne pas la conversion.
  apiPostMock.mockClear();
  sequence = [];

  return observedRef.current;
}

function mergeBodies(): Record<string, unknown>[] {
  return apiPostMock.mock.calls
    .filter(([path]) => path === '/auth/merge-guest')
    .map(([, body]) => (body ?? {}) as Record<string, unknown>);
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sequence = [];

  apiPostMock.mockResolvedValue({});
  linkWithCredentialMock.mockResolvedValue({});
  linkWithPopupMock.mockResolvedValue({});
  guestUser.getIdToken.mockImplementation(async () => {
    sequence.push('getIdToken');
    return GUEST_ID_TOKEN;
  });
  signInWithEmailAndPasswordMock.mockImplementation(async () => {
    sequence.push('signIn');
    return {};
  });
  signInWithPopupMock.mockImplementation(async () => {
    sequence.push('signIn');
    return {};
  });
});

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Firebase émet **deux** codes pour « cet identifiant appartient déjà à un
 * compte », et l'implémentation n'en testait qu'un.
 * `linkWithCredential(EmailAuthProvider.credential(…))` répond
 * `auth/email-already-in-use` ; `auth/credential-already-in-use` est le code
 * des fournisseurs OAuth. Conséquence observée en navigateur pendant E6-3 :
 * l'invité qui s'inscrivait avec un e-mail déjà connu ne déclenchait aucun
 * repli et recevait « Firebase: Error (auth/email-already-in-use) » en pleine
 * modale, ses projets restés sur le compte invité.
 */
describe('le repli se déclenche sur les deux codes Firebase', () => {
  it.each([EMAIL_ALREADY_IN_USE, CREDENTIAL_ALREADY_IN_USE])(
    'fusionne après un échec de lien en « %s »',
    async (code) => {
      linkWithCredentialMock.mockRejectedValue(alreadyInUse(code));
      const auth = await mountAuth();

      await act(async () => {
        await auth.convertGuestAccount('artisan@exemple.fr', 'motdepasse');
      });

      expect(mergeBodies()).toEqual([{ anonymous_id_token: GUEST_ID_TOKEN }]);
    },
  );
});

describe('repli de conversion — preuve de possession', () => {
  it('envoie le jeton de l’invité, jamais son UID', async () => {
    linkWithCredentialMock.mockRejectedValue(
      alreadyInUse(EMAIL_ALREADY_IN_USE),
    );
    const auth = await mountAuth();

    await act(async () => {
      await auth.convertGuestAccount('artisan@exemple.fr', 'motdepasse');
    });

    expect(mergeBodies()).toEqual([{ anonymous_id_token: GUEST_ID_TOKEN }]);
    // L'UID seul suffisait à désigner l'invité de n'importe qui : il ne doit
    // plus voyager du tout.
    expect(JSON.stringify(mergeBodies())).not.toContain(guestUser.uid);
  });

  /**
   * `signInWithEmailAndPassword` remplace `currentUser` : un `getIdToken()`
   * demandé après ne porterait plus sur la session invité — au mieux il
   * échoue, au pire il renvoie le jeton du compte cible, et la fusion se fait
   * sur le mauvais compte.
   */
  it('émet ce jeton avant la reconnexion sur le compte existant', async () => {
    linkWithCredentialMock.mockRejectedValue(
      alreadyInUse(EMAIL_ALREADY_IN_USE),
    );
    const auth = await mountAuth();

    await act(async () => {
      await auth.convertGuestAccount('artisan@exemple.fr', 'motdepasse');
    });

    expect(sequence).toEqual(['getIdToken', 'signIn']);
  });

  it.each([
    ['Google', (auth: Observed) => auth.convertGuestWithGoogle()],
    ['Apple', (auth: Observed) => auth.convertGuestWithApple()],
  ])(
    'suit le même chemin pour la conversion %s',
    async (_provider, convert) => {
      linkWithPopupMock.mockRejectedValue(
        alreadyInUse(CREDENTIAL_ALREADY_IN_USE),
      );
      const auth = await mountAuth();

      await act(async () => {
        await convert(auth);
      });

      expect(mergeBodies()).toEqual([{ anonymous_id_token: GUEST_ID_TOKEN }]);
      expect(sequence).toEqual(['getIdToken', 'signIn']);
    },
  );

  it('propage une erreur de lien qui n’est pas un conflit d’identifiant', async () => {
    linkWithCredentialMock.mockRejectedValue(
      Object.assign(new Error('weak password'), { code: 'auth/weak-password' }),
    );
    const auth = await mountAuth();

    await expect(
      auth.convertGuestAccount('artisan@exemple.fr', '123'),
    ).rejects.toThrow('weak password');

    expect(mergeBodies()).toEqual([]);
  });
});

describe('chemin nominal — le lien réussit', () => {
  it('ne fusionne rien : le compte invité devient le compte inscrit', async () => {
    const auth = await mountAuth();

    await act(async () => {
      await auth.convertGuestAccount('artisan@exemple.fr', 'motdepasse');
    });

    expect(mergeBodies()).toEqual([]);
    expect(signInWithEmailAndPasswordMock).not.toHaveBeenCalled();
    // La synchronisation, elle, a bien lieu.
    expect(apiPostMock).toHaveBeenCalledWith('/auth/sync');
  });
});
