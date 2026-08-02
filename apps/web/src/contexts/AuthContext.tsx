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
import { REFERRAL_CODE_STORAGE_KEY } from '@/lib/referral';

const LOCAL_PROJECTS_KEY = 'chiffreo_local_projects';

// Noms de caches dupliqués depuis public/sw.js (SW_VERSION) — ce fichier n'est pas importable
// par un module TS. Sur un appareil partagé, un cache non vidé à la déconnexion resterait lisible
// hors connexion par le prochain utilisateur connecté, sans aucune vérification d'auth (un hit de
// cache ne passe jamais par le réseau). `chiffreo-shell`/`chiffreo-static` ne contiennent aucune
// donnée liée à un compte et n'ont pas besoin d'être vidés.
const OFFLINE_CACHE_NAMES = ['chiffreo-pages-v1', 'chiffreo-api-v1'];

async function clearOfflineCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  await Promise.all(OFFLINE_CACHE_NAMES.map((name) => caches.delete(name))).catch(() => undefined);
}

interface LocalProjectDraft {
  id: string;
  name: string;
  room_name: string;
  work_type?: string;
  length_m?: number;
  width_m?: number;
  height_m?: number;
  openings?: Array<{
    type: 'door' | 'window';
    width_cm: number;
    height_cm: number;
    count: number;
  }>;
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

  const migrateLocalProjects = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (!raw) return;

    let drafts: LocalProjectDraft[];
    try {
      const parsed = JSON.parse(raw);
      drafts = Array.isArray(parsed) ? parsed : [];
    } catch {
      return;
    }
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
      } catch (err) {
        console.error(`Failed to migrate guest project "${draft.name}":`, err);
      }
    }

    localStorage.removeItem(LOCAL_PROJECTS_KEY);
  }, []);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(getFirebaseAuth(), async (user) => {
      setFirebaseUser(user);
      // Cookie non sensible lu par le middleware pour éviter le flash de
      // contenu protégé. Ce n'est PAS une barrière de sécurité : l'API
      // vérifie le token Firebase sur chaque requête.
      if (user) {
        document.cookie =
          'chiffreo_auth=1; path=/; max-age=2592000; samesite=lax';
        await syncWithBackend();
      } else {
        document.cookie = 'chiffreo_auth=; path=/; max-age=0';
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

  const startGuestSession = useCallback(async () => {
    await signInAnonymously(getFirebaseAuth());
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
      localStorage.removeItem(LOCAL_PROJECTS_KEY);
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
