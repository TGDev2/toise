'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
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
  writeGuestDrafts,
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

/**
 * Sort des brouillons locaux après un passage de `migrateLocalProjects`.
 *
 * La fonction ne lance pas : elle est appelée aussi bien sur le chemin
 * d'acquisition (où l'échec doit arrêter la navigation) que sur les trois voies
 * de conversion (où le compte, lui, a bien été créé — transformer l'échec d'une
 * migration en échec d'inscription mentirait sur ce qui s'est passé). Chaque
 * appelant décide donc quoi faire, à partir d'un résultat qu'il ne peut pas
 * ignorer par distraction.
 */
export interface GuestDraftMigration {
  /** Identifiants serveur des projets créés, dans l'ordre des brouillons. */
  migrated: string[];
  /**
   * Brouillons **toujours présents en `localStorage`** : rien n'a été perdu, et
   * tout reste à rejouer.
   */
  failed: GuestProjectDraft[];
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
  /**
   * Ouvre une session invité **et adopte les brouillons locaux** — une seule
   * opération du point de vue de l'appelant (voir la documentation de
   * `startGuestSession`). Le résultat dit ce qui a été rejoué et ce qui reste
   * sur l'appareil.
   */
  startGuestSession: () => Promise<GuestDraftMigration>;
  /** Rejeu manuel, pour reprendre un brouillon qu'une panne a laissé sur place. */
  migrateLocalProjects: () => Promise<GuestDraftMigration>;
  convertGuestAccount: (email: string, password: string) => Promise<void>;
  convertGuestWithGoogle: () => Promise<void>;
  convertGuestWithApple: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  syncWithBackend: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * « L'identifiant saisi appartient déjà à un compte » — le signal qui fait
 * basculer une conversion invité vers le repli par fusion.
 *
 * **Firebase émet deux codes pour cette même situation**, et n'en retenir qu'un
 * suffisait à condamner tout un chemin. `linkWithCredential` avec une
 * `EmailAuthProvider.credential` répond `auth/email-already-in-use` lorsque
 * l'e-mail est déjà pris ; `auth/credential-already-in-use` est le code des
 * fournisseurs OAuth, quand c'est l'identité tierce elle-même qui est déjà
 * rattachée. Le code ne testait que le second : l'invité qui s'inscrivait avec
 * un e-mail déjà connu ne déclenchait aucun repli et recevait l'erreur Firebase
 * brute (« Firebase: Error (auth/email-already-in-use) ») au lieu de récupérer
 * ses projets. Constaté en navigateur pendant la vérification d'E6-3.
 */
function isIdentifierAlreadyTaken(error: unknown): boolean {
  return (
    errorHasCode(error, 'auth/credential-already-in-use') ||
    errorHasCode(error, 'auth/email-already-in-use')
  );
}

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

  /**
   * Synchronisation en vol, partagée par les appelants concurrents.
   *
   * `onIdTokenChanged` synchronise à chaque changement d'identité, et
   * `startGuestSession` doit **attendre** cette même synchronisation avant de
   * migrer quoi que ce soit : sans ligne `users`, `resolveForFirebaseUid`
   * répond `NotFound` et l'API renvoie 401 sur `POST /projects`. Les deux
   * partent donc en même temps sur un uid neuf — et `upsertFromFirebase` lit
   * puis écrit sans verrou : deux `INSERT` concurrents sur le même
   * `firebase_uid` violent l'unicité et l'un des deux ressort en 500.
   *
   * Coalescer n'est pas un contournement : deux synchronisations simultanées de
   * la même identité sont toujours un défaut, et la seconde n'apprendrait rien
   * de plus que la première.
   */
  const syncInFlight = useRef<Promise<void> | null>(null);

  const syncWithBackend = useCallback(async () => {
    if (syncInFlight.current) return syncInFlight.current;

    const run = (async () => {
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
    })();

    syncInFlight.current = run;
    try {
      await run;
    } finally {
      syncInFlight.current = null;
    }
  }, [redeemPendingReferralCode]);

  /**
   * Rejoue vers l'API les brouillons laissés en `localStorage` par le parcours
   * invité, et ne retire que ceux qui sont **entièrement** passés.
   *
   * **Tout ce que déclare `GuestProjectDraft` doit être repris ici** — un champ
   * saisi par l'invité et non rejoué est une saisie perdue, silencieusement, au
   * moment même où il crée son compte. `guest-drafts.spec.ts` en tient la
   * couverture, champ par champ et exhaustive par le type.
   *
   * **Le `clearGuestDrafts()` inconditionnel qui terminait cette fonction
   * effaçait aussi ce qui venait d'échouer.** Le `catch` se contentant d'un
   * `console.error`, une API injoignable ne coûtait pas un retard : elle coûtait
   * la saisie, définitivement, à l'instant précis où l'utilisateur croyait
   * sauvegarder. Ce qui n'est pas arrivé côté serveur reste donc côté appareil,
   * et l'appelant l'apprend par la valeur de retour.
   *
   * **Le projet créé est le point de bascule.** Si `POST /projects` a réussi
   * mais qu'une étape suivante échoue, le projet est supprimé avant de rendre le
   * brouillon : sans cela, un nouvel essai créerait un doublon et se heurterait
   * au quota invité d'un projet (`GUEST_PROJECT_LIMIT`), c'est-à-dire à un
   * `ACCOUNT_REQUIRED` qui ne parlerait de rien. Quand c'est l'API qui est
   * injoignable, `POST /projects` a déjà échoué : il n'y a rien à supprimer.
   */
  const migrateLocalProjects = useCallback(async (): Promise<GuestDraftMigration> => {
    if (typeof window === 'undefined') return { migrated: [], failed: [] };

    const drafts: GuestProjectDraft[] = readGuestDrafts();
    if (drafts.length === 0) return { migrated: [], failed: [] };

    const migrated: string[] = [];
    const failed: GuestProjectDraft[] = [];

    for (const draft of drafts) {
      let createdId: string | null = null;
      try {
        const created = await apiPost<{ id: string }>('/projects', {
          name: draft.name,
          room_name: draft.room_name,
          work_type: draft.work_type,
        });
        createdId = created.id;

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

        migrated.push(created.id);
      } catch (err) {
        console.error(`Failed to migrate guest project "${draft.name}":`, err);
        if (createdId) {
          await apiDelete(`/projects/${createdId}`).catch(() => undefined);
        }
        failed.push(draft);
      }
    }

    if (failed.length > 0) writeGuestDrafts(failed);
    else clearGuestDrafts();

    return { migrated, failed };
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
   *
   * **Elle adopte aussi les brouillons locaux, et c'est le correctif du
   * cul-de-sac du parcours d'acquisition.** Le calculateur public écrit un
   * brouillon en `localStorage`, ouvre une session invité et navigue. Or un
   * invité a un `appUser` — `onIdTokenChanged` synchronise *tout* utilisateur, y
   * compris anonyme — si bien que chaque branche `if (appUser)` des écrans
   * suivants prenait le chemin API avec un identifiant de projet purement local.
   * Le brouillon, lui, n'était rejoué que par les trois voies de conversion.
   * L'écran de dimensions demandait donc `/projects/<uuid-local>`, récoltait un
   * 404, et restait sur son squelette.
   *
   * Deux stratégies étaient possibles : migrer à l'ouverture de la session, ou
   * n'ouvrir la session qu'une fois le brouillon migré. **La seconde n'existe
   * pas** : `POST /projects` est derrière `FirebaseAuthGuard`, et
   * `OrgContextService.resolveForFirebaseUid` exige en plus une ligne `users`
   * que seul `POST /auth/sync` crée. Aucun ordre ne fait partir le brouillon
   * avant la session. Ce qui se décide, c'est le moment où la session devient
   * observable par l'appelant : jamais avant que les brouillons soient adoptés.
   *
   * D'où l'ordre des trois étapes, chacune imposée par la précédente :
   * `signInAnonymously` (le jeton) → `syncWithBackend` (la ligne `users`, sans
   * laquelle tout `POST /projects` répond 401) → `migrateLocalProjects`.
   */
  const startGuestSession = useCallback(async (): Promise<GuestDraftMigration> => {
    setIsLoading(true);
    try {
      await signInAnonymously(getFirebaseAuth());
      markSessionPresent();
      await syncWithBackend();
      return await migrateLocalProjects();
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  }, [syncWithBackend, migrateLocalProjects]);

  /**
   * Repli de conversion : l'identifiant saisi appartient déjà à un compte, donc
   * `linkWithCredential`/`linkWithPopup` est impossible (voir
   * `isIdentifierAlreadyTaken`). On se reconnecte sur ce compte, puis on
   * demande à l'API d'y absorber la session invité.
   *
   * **Le jeton de l'invité est émis avant la reconnexion, et l'ordre est le
   * correctif E6-3.** C'est ce jeton qui prouve à l'API que l'appelant
   * contrôlait bien cette session — auparavant on n'envoyait que l'UID, un
   * identifiant public qui permettait de désigner l'invité de n'importe qui.
   * `signInWith*` remplace `currentUser` : après lui, ce jeton n'est plus
   * émettable, d'où la capture en premier geste.
   *
   * Un seul exemplaire de ce bloc, appelé par les trois voies de conversion :
   * trois copies dérivent, et celle qui dérive est celle qui perd la preuve.
   */
  const absorbGuestInto = useCallback(
    async (guest: FirebaseUser, reauthenticate: () => Promise<unknown>) => {
      const anonymousIdToken = await guest.getIdToken();
      await reauthenticate();
      await apiPost('/auth/merge-guest', {
        anonymous_id_token: anonymousIdToken,
      });
      await syncWithBackend();
      await migrateLocalProjects();
    },
    [syncWithBackend, migrateLocalProjects],
  );

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
        if (isIdentifierAlreadyTaken(error)) {
          await absorbGuestInto(currentUser, () =>
            signInWithEmailAndPassword(getFirebaseAuth(), email, password),
          );
        } else {
          throw error;
        }
      }
    },
    [syncWithBackend, migrateLocalProjects, absorbGuestInto],
  );

  const convertGuestWithGoogle = useCallback(async () => {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser?.isAnonymous) return;

    try {
      await linkWithPopup(currentUser, googleProvider);
      await syncWithBackend();
      await migrateLocalProjects();
    } catch (error: unknown) {
      if (isIdentifierAlreadyTaken(error)) {
        await absorbGuestInto(currentUser, () =>
          signInWithPopup(getFirebaseAuth(), googleProvider),
        );
      } else {
        throw error;
      }
    }
  }, [syncWithBackend, migrateLocalProjects, absorbGuestInto]);

  const convertGuestWithApple = useCallback(async () => {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser?.isAnonymous) return;

    try {
      await linkWithPopup(currentUser, appleProvider);
      await syncWithBackend();
      await migrateLocalProjects();
    } catch (error: unknown) {
      if (isIdentifierAlreadyTaken(error)) {
        await absorbGuestInto(currentUser, () =>
          signInWithPopup(getFirebaseAuth(), appleProvider),
        );
      } else {
        throw error;
      }
    }
  }, [syncWithBackend, migrateLocalProjects, absorbGuestInto]);

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
        startGuestSession,
        migrateLocalProjects,
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
