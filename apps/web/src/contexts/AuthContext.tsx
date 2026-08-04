'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  SAMLAuthProvider,
  linkWithCredential,
  linkWithPopup,
  onIdTokenChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { apiDelete, apiPost, apiPut } from '@/lib/api';
import { errorHasCode } from '@/lib/errors';
import { getFirebaseAuth } from '@/lib/firebase';
import {
  clearGuestDrafts,
  readGuestDrafts,
  type GuestProjectDraft,
} from '@/lib/guest-drafts';
import { REFERRAL_CODE_STORAGE_KEY } from '@/lib/referral';

// Préfixes de caches dupliqués depuis public/sw.js (SW_VERSION) — ce fichier n'est pas importable
// par un module TS. Sur un appareil partagé, un cache non vidé resterait lisible hors connexion
// par le prochain utilisateur connecté, sans aucune vérification d'auth (un hit de cache ne passe
// jamais par le réseau). `chiffreo-shell`/`chiffreo-static` ne contiennent aucune donnée liée à un
// compte et n'ont pas besoin d'être vidés. Le cache API étant partitionné par uid, ses noms ne
// sont pas énumérables en dur : on les retrouve par préfixe.
const OFFLINE_CACHE_PREFIXES = ['chiffreo-pages-v1', 'chiffreo-api-v1'];

// Dernière identité vue par cet appareil. En `localStorage` et pas en mémoire : un onglet
// fermé sans déconnexion ne doit pas faire oublier à qui appartiennent les caches.
const LAST_IDENTITY_KEY = 'chiffreo_last_uid';

async function clearOfflineCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => OFFLINE_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)))
        .map((name) => caches.delete(name)),
    );
  } catch {
    // Le stockage peut être indisponible (navigation privée, quota) : ne jamais
    // faire échouer une connexion ou une déconnexion pour autant.
  }
}

function readLastIdentity(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LAST_IDENTITY_KEY);
  } catch {
    return null;
  }
}

function writeLastIdentity(uid: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (uid) localStorage.setItem(LAST_IDENTITY_KEY, uid);
    else localStorage.removeItem(LAST_IDENTITY_KEY);
  } catch {
    // Idem : la mémoire de l'identité précédente est un confort, pas un prérequis.
  }
}

/**
 * Marqueur de présence de session lu par `proxy.ts` — un cookie non sensible,
 * jamais le jeton Firebase (l'API vérifie ce dernier à chaque requête).
 *
 * Écrit ici plutôt qu'en ligne dans deux endroits : `startGuestSession` doit le
 * poser avant de rendre la main, et `onIdTokenChanged` le pose pour toutes les
 * autres entrées en session. Deux chaînes recopiées finiraient par diverger sur
 * le `path` ou le `max-age`, et la divergence se paierait en redirections
 * inexplicables vers `/login`.
 */
const SESSION_MARKER_COOKIE = 'chiffreo_auth';

function markSessionPresent(): void {
  document.cookie = `${SESSION_MARKER_COOKIE}=1; path=/; max-age=2592000; samesite=lax`;
}

function clearSessionMarker(): void {
  document.cookie = `${SESSION_MARKER_COOKIE}=; path=/; max-age=0`;
}

/**
 * Purge les caches hors ligne dès que l'identité de l'appareil change.
 *
 * `logout` le faisait déjà, mais rien n'impose de se déconnecter : le cas courant sur un
 * appareil partagé est une connexion par-dessus la session précédente. Le changement
 * d'identité, lui, est toujours observé — c'est donc à lui qu'on accroche la purge.
 * Un simple rafraîchissement de jeton (même uid) ne purge rien, sans quoi le cache hors
 * ligne ne survivrait jamais assez longtemps pour servir.
 *
 * Une identité inconnue purge aussi : sans mémoire de qui a rempli les caches présents,
 * les garder reviendrait à parier qu'ils appartiennent à l'arrivant.
 */
async function syncOfflineCachesWithIdentity(uid: string | null): Promise<void> {
  if (readLastIdentity() === uid) return;
  await clearOfflineCaches();
  writeLastIdentity(uid);
}

export interface CompanyProfilePayload {
  raison_sociale: string;
  siret: string;
  address_line1: string;
  address_line2?: string;
  postal_code: string;
  city: string;
  phone?: string;
  specialties?: string[];
}

interface AppUser {
  id: string;
  email: string | null;
  auth_provider: string;
  subscription_tier: string;
  role: string;
  email_verified: boolean;
  created_at: string;
  has_company_profile: boolean;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  isGuest: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName?: string,
    companyProfile?: CompanyProfilePayload,
  ) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  loginWithSso: (providerId: string) => Promise<void>;
  startGuestSession: () => Promise<void>;
  convertGuestAccount: (email: string, password: string) => Promise<void>;
  convertGuestWithGoogle: () => Promise<void>;
  convertGuestWithApple: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  syncWithBackend: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider('apple.com');
const EMAIL_VERIFICATION_REQUIRED_MESSAGE =
  'Vérifiez votre email pour activer votre compte avant de vous connecter.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isGuest = firebaseUser?.isAnonymous ?? false;

  const redeemPendingReferralCode = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const code = localStorage.getItem(REFERRAL_CODE_STORAGE_KEY);
    if (!code) return;

    // Best-effort : l'éligibilité réelle (un seul parrainage, fenêtre de 7
    // jours) est vérifiée côté serveur, qui ne renvoie jamais d'erreur
    // bloquante. On efface la clé dans tous les cas pour ne tenter qu'une
    // fois par lien cliqué.
    await apiPost('/referrals/redeem', { code }).catch(() => undefined);
    localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
  }, []);

  const syncWithBackend = useCallback(async () => {
    try {
      const user = await apiPost<AppUser>('/auth/sync');
      setAppUser(user);
    } catch {
      setAppUser(null);
      return;
    }
    // Ne doit jamais faire échouer la synchronisation du compte : déjà
    // best-effort en interne (voir redeemPendingReferralCode).
    await redeemPendingReferralCode();
  }, [redeemPendingReferralCode]);

  /**
   * Rejoue vers l'API les brouillons laissés en `localStorage` par le parcours
   * invité, puis vide la clé.
   *
   * **Tout ce que déclare `GuestProjectDraft` doit être repris ici** — un champ
   * saisi par l'invité et non rejoué est une saisie perdue, silencieusement, au
   * moment même où il crée son compte. `guest-drafts.spec.ts` en tient la
   * couverture, champ par champ et exhaustive par le type.
   */
  const migrateLocalProjects = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const drafts: GuestProjectDraft[] = readGuestDrafts();
    if (drafts.length === 0) return;

    for (const draft of drafts) {
      try {
        const created = await apiPost<{ id: string }>('/projects', {
          name: draft.name,
          room_name: draft.room_name,
          work_type: draft.work_type,
        });

        if (draft.length_m && draft.width_m && draft.height_m) {
          await apiPut(`/projects/${created.id}/dimensions`, {
            length_cm: Math.round(draft.length_m * 100),
            width_cm: Math.round(draft.width_m * 100),
            height_cm: Math.round(draft.height_m * 100),
            segments: draft.segments?.length ? draft.segments : undefined,
            exclusions: draft.exclusions?.length ? draft.exclusions : undefined,
          });
        }

        if (draft.openings?.length) {
          for (const opening of draft.openings) {
            await apiPost(`/projects/${created.id}/openings`, {
              type: opening.type,
              width_cm: opening.width_cm,
              height_cm: opening.height_cm,
              count: opening.count,
            });
          }
        }

        // Les ouvrages retenus à l'étape « Sélection des travaux ». Sans eux,
        // l'invité qui s'inscrivait retrouvait une pièce mesurée mais vide,
        // impossible à chiffrer sans tout resaisir. La route refuse une liste
        // vide (`ArrayMinSize(1)`) : ne l'appeler que s'il y a quelque chose.
        if (draft.work_items?.length) {
          await apiPost(`/projects/${created.id}/work-items`, {
            items: draft.work_items,
          });
        }
      } catch (err) {
        console.error(`Failed to migrate guest project "${draft.name}":`, err);
      }
    }

    clearGuestDrafts();
  }, []);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(getFirebaseAuth(), async (user) => {
      setFirebaseUser(user);
      // Avant toute lecture de données : le compte qui arrive ne doit pas pouvoir lire
      // hors ligne ce que le précédent a laissé en cache.
      await syncOfflineCachesWithIdentity(user?.uid ?? null);
      // Cookie non sensible lu par le middleware pour éviter le flash de
      // contenu protégé. Ce n'est PAS une barrière de sécurité : l'API
      // vérifie le token Firebase sur chaque requête.
      if (user) {
        markSessionPresent();
        await syncWithBackend();
      } else {
        clearSessionMarker();
        setAppUser(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, [syncWithBackend]);

  const login = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    const credential = await signInWithEmailAndPassword(auth, email, password);

    await credential.user.reload();

    if (!credential.user.emailVerified) {
      await sendEmailVerification(credential.user).catch(() => undefined);
      await signOut(auth);
      throw new Error(EMAIL_VERIFICATION_REQUIRED_MESSAGE);
    }
  }, []);

  const register = useCallback(
    async (
      email: string,
      password: string,
      displayName?: string,
      companyProfile?: CompanyProfilePayload,
    ) => {
      const auth = getFirebaseAuth();

      await apiPost('/auth/register', {
        email,
        password,
        display_name: displayName,
        ...(companyProfile ? { company_profile: companyProfile } : {}),
      });

      const credential = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(credential.user);
      await signOut(auth);
    },
    [],
  );

  const loginWithGoogle = useCallback(async () => {
    await signInWithPopup(getFirebaseAuth(), googleProvider);
  }, []);

  const loginWithApple = useCallback(async () => {
    await signInWithPopup(getFirebaseAuth(), appleProvider);
  }, []);

  /**
   * Connexion fédérée d'entreprise (BACKLOG PLAT-6). `providerId` vient de
   * `GET /sso/discover` et n'est jamais saisi par l'utilisateur : c'est
   * l'identifiant que l'API a émis en créant le fournisseur.
   *
   * Aucun contrôle de vérification d'e-mail ici, contrairement à `login` : c'est
   * l'IdP de l'entreprise qui fait autorité sur ses propres comptes.
   */
  const loginWithSso = useCallback(async (providerId: string) => {
    const provider = providerId.startsWith('saml.')
      ? new SAMLAuthProvider(providerId)
      : new OAuthProvider(providerId);
    await signInWithPopup(getFirebaseAuth(), provider);
  }, []);

  /**
   * Ouverture d'une session invité.
   *
   * **`isLoading` est réarmé avant l'appel Firebase, et c'est le cœur du
   * correctif E2-1.** `signInAnonymously` résout dès que Firebase a émis le
   * jeton, mais l'utilisateur applicatif n'existe qu'après le `POST /auth/sync`
   * que déclenche `onIdTokenChanged`. Entre les deux, l'état observable par les
   * écrans est exactement celui d'un visiteur anonyme sans session :
   * `appUser === null`, et `isGuest` encore `false` tant que React n'a pas
   * propagé le nouveau `firebaseUser`. Comme `isLoading` était retombé à `false`
   * au tout premier `onIdTokenChanged` (celui qui constate l'absence de
   * session), la garde de la page d'arrivée s'exécutait dans cette fenêtre et
   * renvoyait vers `/login` — sans un mot, au clic même sur « Essayer sans
   * compte ». Observé en navigateur : la navigation vers `/login` part pendant
   * que `/auth/sync` est encore en vol.
   *
   * Le drapeau n'est pas retombé ici en cas de succès : c'est
   * `onIdTokenChanged` qui l'abaisse, une fois la synchronisation terminée. En
   * cas d'échec en revanche, aucun événement ne viendra — il faut le rendre
   * soi-même, sous peine de laisser l'application sur son écran de chargement.
   *
   * **Le marqueur de session est posé ici, et pas seulement dans
   * `onIdTokenChanged`.** L'appelant navigue vers `/dashboard` dès que cette
   * promesse résout, et `proxy.ts` redirige vers `/login` toute requête
   * `/dashboard` ou `/projects/*` dépourvue du cookie. L'observateur de jeton
   * est asynchrone : il pose le cookie *parfois* après cette navigation, ce qui
   * rendait l'échec intermittent — donc invisible en développement et fatal
   * dans le funnel. La garde anti-flash serveur ne peut pas s'appuyer sur un
   * état que le client n'a pas encore publié.
   */
  const startGuestSession = useCallback(async () => {
    setIsLoading(true);
    try {
      await signInAnonymously(getFirebaseAuth());
      markSessionPresent();
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  }, []);

  const convertGuestAccount = useCallback(
    async (email: string, password: string) => {
      const currentUser = getFirebaseAuth().currentUser;
      if (!currentUser?.isAnonymous) return;

      try {
        const credential = EmailAuthProvider.credential(email, password);
        await linkWithCredential(currentUser, credential);
        await sendEmailVerification(currentUser);
        await syncWithBackend();
        await migrateLocalProjects();
      } catch (error: unknown) {
        if (errorHasCode(error, 'auth/credential-already-in-use')) {
          const anonymousUid = currentUser.uid;
          await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
          await apiPost('/auth/merge-guest', {
            anonymous_firebase_uid: anonymousUid,
          });
          await syncWithBackend();
          await migrateLocalProjects();
        } else {
          throw error;
        }
      }
    },
    [syncWithBackend, migrateLocalProjects],
  );

  const convertGuestWithGoogle = useCallback(async () => {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser?.isAnonymous) return;

    try {
      await linkWithPopup(currentUser, googleProvider);
      await syncWithBackend();
      await migrateLocalProjects();
    } catch (error: unknown) {
      if (errorHasCode(error, 'auth/credential-already-in-use')) {
        const anonymousUid = currentUser.uid;
        await signInWithPopup(getFirebaseAuth(), googleProvider);
        await apiPost('/auth/merge-guest', {
          anonymous_firebase_uid: anonymousUid,
        });
        await syncWithBackend();
        await migrateLocalProjects();
      } else {
        throw error;
      }
    }
  }, [syncWithBackend, migrateLocalProjects]);

  const convertGuestWithApple = useCallback(async () => {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser?.isAnonymous) return;

    try {
      await linkWithPopup(currentUser, appleProvider);
      await syncWithBackend();
      await migrateLocalProjects();
    } catch (error: unknown) {
      if (errorHasCode(error, 'auth/credential-already-in-use')) {
        const anonymousUid = currentUser.uid;
        await signInWithPopup(getFirebaseAuth(), appleProvider);
        await apiPost('/auth/merge-guest', {
          anonymous_firebase_uid: anonymousUid,
        });
        await syncWithBackend();
        await migrateLocalProjects();
      } else {
        throw error;
      }
    }
  }, [syncWithBackend, migrateLocalProjects]);

  const logout = useCallback(async () => {
    await Promise.all([signOut(getFirebaseAuth()), clearOfflineCaches()]);
    setAppUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    await apiDelete('/auth/me');
    if (typeof window !== 'undefined') {
      clearGuestDrafts();
    }
    await Promise.all([signOut(getFirebaseAuth()).catch(() => undefined), clearOfflineCaches()]);
    setFirebaseUser(null);
    setAppUser(null);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    await apiPost('/auth/forgot-password', { email }).catch(() => undefined);

    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
    } catch (error: unknown) {
      if (!errorHasCode(error, 'auth/user-not-found')) {
        throw error;
      }
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        appUser,
        isGuest,
        isLoading,
        login,
        register,
        loginWithGoogle,
        loginWithApple,
        loginWithSso,
        startGuestSession,
        convertGuestAccount,
        convertGuestWithGoogle,
        convertGuestWithApple,
        logout,
        deleteAccount,
        forgotPassword,
        syncWithBackend,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
