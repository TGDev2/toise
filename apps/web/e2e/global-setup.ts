import * as admin from 'firebase-admin';
import { Client } from 'pg';
import {
  API_URL,
  ARTISAN_EMAIL,
  ARTISAN_LABOR_RATE,
  ARTISAN_PASSWORD,
  ARTISAN_SIRET,
  FIREBASE_AUTH_EMULATOR_HOST,
  FIREBASE_PROJECT_ID,
  FREE_EMAIL,
  FREE_PASSWORD,
} from './fixtures';

/**
 * Seed des deux comptes inscrits des scénarios : l'artisan au palier payant
 * (scénario devis-minute → PDF) et le compte **gratuit** d'E3-2.
 *
 * Le flow d'inscription normal (`POST /auth/register`) laisse l'email non
 * vérifié — `login()` le refuse tant que ce n'est pas le cas — et aucune route
 * ne permet d'élever `subscription_tier` (piloté par Stripe en prod). On crée
 * donc le compte via l'API réelle (matérialise aussi l'organisation et le
 * profil entreprise en un appel via `company_profile` inline), puis on force
 * les deux à la main : `firebase-admin` contre l'émulateur pour
 * `emailVerified`, une requête `pg` directe pour le palier d'abonnement.
 *
 * Idempotent, y compris quand les deux stores dérivent l'un de l'autre (en
 * local, Postgres survit aux redémarrages, l'émulateur Auth non — sa donnée
 * est en mémoire) : un 409 de `register` avec un utilisateur Firebase absent
 * recrée ce dernier directement, et la ligne `users` déjà existante est
 * republiée sur son nouvel `uid` plutôt que recréée (préserve organisation et
 * profil entreprise déjà seedés lors du premier passage).
 */
export default async function globalSetup(): Promise<void> {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = FIREBASE_AUTH_EMULATOR_HOST;

  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: FIREBASE_PROJECT_ID });
  }

  await seedFreeAccount();

  const registerRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: ARTISAN_EMAIL,
      password: ARTISAN_PASSWORD,
      display_name: 'Artisan E2E',
      company_profile: {
        raison_sociale: 'Artisan E2E SARL',
        siret: ARTISAN_SIRET,
        address_line1: '1 rue du Test',
        postal_code: '75001',
        city: 'Paris',
        default_labor_hourly_rate: ARTISAN_LABOR_RATE,
      },
    }),
  });

  if (!registerRes.ok && registerRes.status !== 409) {
    throw new Error(
      `Échec de la création du compte artisan E2E : ${registerRes.status} ${await registerRes.text()}`,
    );
  }

  let firebaseUser: admin.auth.UserRecord;
  try {
    firebaseUser = await admin.auth().getUserByEmail(ARTISAN_EMAIL);
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    firebaseUser = await admin.auth().createUser({
      email: ARTISAN_EMAIL,
      password: ARTISAN_PASSWORD,
      emailVerified: true,
    });
  }

  if (!firebaseUser.emailVerified) {
    await admin.auth().updateUser(firebaseUser.uid, { emailVerified: true });
  }

  const db = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'chiffreo',
    password: process.env.DB_PASSWORD ?? 'chiffreo_dev',
    database: process.env.DB_NAME ?? 'chiffreo',
  });
  await db.connect();
  try {
    await db.query(
      `UPDATE users SET subscription_tier = 'contractor_essentiel', firebase_uid = $2 WHERE email = $1`,
      [ARTISAN_EMAIL, firebaseUser.uid],
    );
  } finally {
    await db.end();
  }
}

/**
 * Compte gratuit inscrit. Même contournement que pour l'artisan et pour la même
 * raison — `POST /auth/register` laisse l'e-mail non vérifié, `login()` le
 * refuse — mais **sans** la requête `pg` qui élève le palier : le défaut de
 * `users.subscription_tier` est `free`, et c'est précisément l'état qu'on veut
 * observer. Le forcer reviendrait à faire dire au harnais ce qu'il est censé
 * constater.
 *
 * Le `firebase_uid` est republié quand l'émulateur a été purgé sans que
 * Postgres le soit (leur durée de vie diffère en local) : sans cela, la ligne
 * `users` resterait accrochée à un uid mort et `/auth/sync` créerait un second
 * compte, gratuit lui aussi mais vierge — le test passerait pour de mauvaises
 * raisons.
 */
async function seedFreeAccount(): Promise<void> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: FREE_EMAIL,
      password: FREE_PASSWORD,
      display_name: 'Compte gratuit E2E',
    }),
  });

  if (!res.ok && res.status !== 409) {
    throw new Error(
      `Échec de la création du compte gratuit E2E : ${res.status} ${await res.text()}`,
    );
  }

  let user: admin.auth.UserRecord;
  try {
    user = await admin.auth().getUserByEmail(FREE_EMAIL);
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    user = await admin.auth().createUser({
      email: FREE_EMAIL,
      password: FREE_PASSWORD,
      emailVerified: true,
    });
  }

  if (!user.emailVerified) {
    await admin.auth().updateUser(user.uid, { emailVerified: true });
  }

  const db = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'chiffreo',
    password: process.env.DB_PASSWORD ?? 'chiffreo_dev',
    database: process.env.DB_NAME ?? 'chiffreo',
  });
  await db.connect();
  try {
    await db.query(`UPDATE users SET firebase_uid = $2 WHERE email = $1`, [
      FREE_EMAIL,
      user.uid,
    ]);
  } finally {
    await db.end();
  }
}
