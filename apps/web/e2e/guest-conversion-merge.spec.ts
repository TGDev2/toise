import { expect, test } from '@playwright/test';
import { API_URL } from './fixtures';

/**
 * Conversion invité par **repli** : l'e-mail saisi appartient déjà à un compte,
 * donc le lien Firebase est impossible et le front bascule sur
 * `POST /auth/merge-guest`.
 *
 * Deux défauts distincts se cachaient sur ce seul chemin, et aucun test unitaire
 * ne pouvait les voir :
 *
 * 1. **La requête ne prouvait rien** (E6-3). Le corps ne portait que l'UID de
 *    l'invité — un identifiant public : n'importe quel compte authentifié
 *    pouvait désigner l'invité d'un tiers, absorber ses projets et faire
 *    supprimer son compte. Le corps porte maintenant le **jeton** de l'invité,
 *    et ce test vérifie les deux jetons réellement envoyés sur le réseau.
 * 2. **Le repli ne se déclenchait jamais pour une conversion par e-mail.**
 *    `linkWithCredential` répond `auth/email-already-in-use`, pas
 *    `auth/credential-already-in-use` que le code guettait. Le visiteur voyait
 *    l'erreur Firebase brute en pleine modale et gardait ses projets sur son
 *    compte invité. Constaté en navigateur, invisible en test unitaire tant que
 *    le mock rendait le code que le code attendait.
 */

const SUFFIX = Date.now().toString(36);
const EMAIL = `e2e-merge-${SUFFIX}@chiffreo.test`;
const PASSWORD = 'E2eMerge!2026';
const PROJECT = `Projet invité ${SUFFIX}`;

interface Claims {
  sub: string;
  email?: string;
  firebase?: { sign_in_provider?: string };
}

function claims(jwt: string): Claims {
  const payload = jwt.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as Claims;
}

test('un invité fusionne dans un compte existant en prouvant qu’il possède sa session', async ({
  page,
  request,
}) => {
  // Le compte cible existe déjà : c'est ce qui rend le lien Firebase impossible
  // et fait passer la conversion par le repli.
  const registered = await request.post(`${API_URL}/auth/register`, {
    data: { email: EMAIL, password: PASSWORD, display_name: 'Artisan E2E' },
  });
  expect(registered.ok()).toBeTruthy();

  let sentBody: Record<string, unknown> | null = null;
  let sentAuth: string | null = null;
  page.on('request', (req) => {
    if (req.url().includes('/auth/merge-guest') && req.method() === 'POST') {
      sentBody = JSON.parse(req.postData() ?? '{}') as Record<string, unknown>;
      sentAuth = req.headers()['authorization'] ?? null;
    }
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Accepter' }).click();
  await page.getByRole('button', { name: 'Essayer sans compte' }).first().click();

  await page.getByRole('button', { name: 'Créer un projet' }).click();
  await page.getByLabel('Nom du projet').fill(PROJECT);
  await page.getByLabel('Pièce concernée').fill('Salon');
  await page.getByRole('button', { name: 'Continuer vers les dimensions' }).click();
  await expect(page.getByRole('heading', { name: 'Dimensions de la pièce' })).toBeVisible();

  // Le quota invité est d'un projet : en demander un second renvoie
  // ACCOUNT_REQUIRED, ce qui ouvre la modale de conversion.
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Créer un projet' }).click();
  await page.getByLabel('Nom du projet').fill('Second projet');
  await page.getByLabel('Pièce concernée').fill('Cuisine');
  await page.getByRole('button', { name: 'Continuer vers les dimensions' }).click();

  await expect(
    page.getByRole('heading', { name: 'Créez un compte pour sauvegarder' }),
  ).toBeVisible();
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Mot de passe', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirmer le mot de passe').fill(PASSWORD);
  await page.getByRole('button', { name: "S'inscrire et sauvegarder" }).click();

  // Le défaut n°2 se voyait exactement ici : une alerte d'erreur Firebase à la
  // place du succès.
  await expect(page.getByText('Compte créé.')).toBeVisible({ timeout: 20_000 });

  expect(sentBody).not.toBeNull();
  const body = sentBody as unknown as Record<string, unknown>;
  expect(Object.keys(body)).toEqual(['anonymous_id_token']);

  const guest = claims(body.anonymous_id_token as string);
  const caller = claims((sentAuth as unknown as string).replace('Bearer ', ''));

  // Deux principals distincts présentés ensemble : c'est la preuve de possession.
  expect(guest.firebase?.sign_in_provider).toBe('anonymous');
  expect(caller.firebase?.sign_in_provider).toBe('password');
  expect(caller.email).toBe(EMAIL);
  expect(guest.sub).not.toBe(caller.sub);

  // L'UID de l'invité ne voyage plus en clair : c'était toute la faille.
  expect(JSON.stringify(body)).not.toContain(guest.sub);

  // Et la conversion a bien fait son travail : le projet a changé de compte.
  const projects = await request.get(`${API_URL}/projects`, {
    headers: { Authorization: sentAuth as unknown as string },
  });
  expect(projects.ok()).toBeTruthy();
  const payload = (await projects.json()) as
    | { data?: { name: string }[] }
    | { name: string }[];
  const list = Array.isArray(payload) ? payload : (payload.data ?? []);
  expect(list.map((p) => p.name)).toContain(PROJECT);
});
