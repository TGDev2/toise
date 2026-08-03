import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return app;
}

/**
 * Émulateur Firebase Auth, en développement uniquement.
 *
 * Sans cela, aucun parcours authentifié — à commencer par le mode invité — ne
 * peut être déroulé en local : le dépôt ne livre pas d'identifiants Firebase et
 * `.env.example` porte des valeurs factices. Un parcours qu'on ne peut pas
 * exécuter est un parcours qu'on ne peut pas vérifier (leçon 19).
 *
 * Piloté par la seule présence de `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` :
 * variable absente, code inerte. Elle n'existe pas en production, où le SDK
 * parle au vrai Firebase exactement comme avant. Le pendant côté API est
 * `FIREBASE_AUTH_EMULATOR_HOST`, lu directement par `firebase-admin`.
 */
function connectEmulatorIfConfigured(auth: Auth): void {
  const host = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (!host) return;
  connectAuthEmulator(auth, `http://${host}`, { disableWarnings: true });
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
    connectEmulatorIfConfigured(authInstance);
  }
  return authInstance;
}

// For convenience in client-only contexts
export const auth = typeof window !== 'undefined' ? getFirebaseAuth() : (null as unknown as Auth);
