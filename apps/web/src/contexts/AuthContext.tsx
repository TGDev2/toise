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
import { apiDelete, apiPost } from '@/lib/api';
import { errorHasCode } from '@/lib/errors';
import { getFirebaseAuth } from '@/lib/firebase';

interface AppUser {
  id: string;
  email: string | null;
  auth_provider: string;
  subscription_tier: string;
  email_verified: boolean;
  created_at: string;
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
  ) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  startGuestSession: () => Promise<void>;
  convertGuestAccount: (email: string, password: string) => Promise<void>;
  convertGuestWithGoogle: () => Promise<void>;
  convertGuestWithApple: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider('apple.com');
const EMAIL_VERIFICATION_REQUIRED_MESSAGE =
  'Verifiez votre email pour activer votre compte avant de vous connecter.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isGuest = firebaseUser?.isAnonymous ?? false;

  const syncWithBackend = useCallback(async () => {
    try {
      const user = await apiPost<AppUser>('/auth/sync');
      setAppUser(user);
    } catch {
      setAppUser(null);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(getFirebaseAuth(), async (user) => {
      setFirebaseUser(user);
      if (user) {
        await syncWithBackend();
      } else {
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
    async (email: string, password: string, displayName?: string) => {
      const auth = getFirebaseAuth();

      await apiPost('/auth/register', {
        email,
        password,
        display_name: displayName,
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
      } catch (error: unknown) {
        if (errorHasCode(error, 'auth/credential-already-in-use')) {
          const anonymousUid = currentUser.uid;
          await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
          await apiPost('/auth/merge-guest', {
            anonymous_firebase_uid: anonymousUid,
          });
          await syncWithBackend();
        } else {
          throw error;
        }
      }
    },
    [syncWithBackend],
  );

  const convertGuestWithGoogle = useCallback(async () => {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser?.isAnonymous) return;

    try {
      await linkWithPopup(currentUser, googleProvider);
      await syncWithBackend();
    } catch (error: unknown) {
      if (errorHasCode(error, 'auth/credential-already-in-use')) {
        const anonymousUid = currentUser.uid;
        await signInWithPopup(getFirebaseAuth(), googleProvider);
        await apiPost('/auth/merge-guest', {
          anonymous_firebase_uid: anonymousUid,
        });
        await syncWithBackend();
      } else {
        throw error;
      }
    }
  }, [syncWithBackend]);

  const convertGuestWithApple = useCallback(async () => {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser?.isAnonymous) return;

    try {
      await linkWithPopup(currentUser, appleProvider);
      await syncWithBackend();
    } catch (error: unknown) {
      if (errorHasCode(error, 'auth/credential-already-in-use')) {
        const anonymousUid = currentUser.uid;
        await signInWithPopup(getFirebaseAuth(), appleProvider);
        await apiPost('/auth/merge-guest', {
          anonymous_firebase_uid: anonymousUid,
        });
        await syncWithBackend();
      } else {
        throw error;
      }
    }
  }, [syncWithBackend]);

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth());
    setAppUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    await apiDelete('/auth/me');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('estimate_local_projects');
    }
    await signOut(getFirebaseAuth()).catch(() => undefined);
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
        convertGuestAccount,
        convertGuestWithGoogle,
        convertGuestWithApple,
        logout,
        deleteAccount,
        forgotPassword,
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
