import { expect, test } from '@playwright/test';
import { acceptCookies } from './helpers';

/**
 * Le cul-de-sac du parcours d'acquisition, de bout en bout.
 *
 * C'est la **sortie du seul canal construit** : un visiteur sans session arrive
 * sur un calculateur public, chiffre, clique « Sauvegarder mon projet ». Rien
 * dans le dépôt ne couvrait ce chemin — `guest-estimate-flow.spec.ts` part de la
 * page d'accueil, où aucun brouillon local n'existe, et passait donc au vert
 * alors même que le canal était cassé.
 *
 * Trois défauts composés, dont ce scénario est la preuve conjointe :
 *
 * 1. Un invité a un `appUser` — `onIdTokenChanged` synchronise *tout*
 *    utilisateur, y compris anonyme. Toutes les branches `if (appUser)`
 *    prenaient donc le chemin API avec un identifiant de projet purement local.
 * 2. `startGuestSession` ne rejouait pas `migrateLocalProjects` : le brouillon
 *    n'atteignait jamais l'API.
 * 3. Sur la page de dimensions, le 404 laissait `rooms` vide, donc `formReady`
 *    faux, et le `return` du squelette précédait l'alerte : l'écran restait en
 *    chargement, sans un mot.
 *
 * Ce que le scénario exige : le projet ouvert à l'arrivée est celui que **l'API
 * a créé** (son identifiant est relevé sur le réseau, pas déduit), la clé locale
 * est vide, et la page de dimensions affiche les valeurs saisies sur le
 * calculateur — pas un squelette, pas un formulaire vierge.
 */

const DRAFTS_KEY = 'toise_local_projects';

test('un visiteur sans session passe du calculateur public au projet créé côté API', async ({
  page,
}) => {
  // L'identifiant relevé sur le réseau : c'est lui qui distingue un projet réel
  // d'un uuid local, et aucune assertion d'URL ne le prouverait toute seule.
  let createdProjectId: string | null = null;
  page.on('response', async (response) => {
    const request = response.request();
    if (
      request.method() === 'POST' &&
      response.url().endsWith('/projects') &&
      response.ok()
    ) {
      const body = (await response.json().catch(() => null)) as
        | { id?: string }
        | null;
      if (body?.id) createdProjectId = body.id;
    }
  });

  await page.goto('/calculateurs/peinture');
  await acceptCookies(page);

  await page.getByLabel('Longueur (m)').fill('4');
  await page.getByLabel('Largeur (m)').fill('3');
  await page.getByLabel('Hauteur (m)').fill('2.5');
  // Une ouverture évite la question « aucune ouverture ? » au premier envoi, et
  // donne au passage une donnée de plus à suivre jusqu'au bout.
  await page.getByRole('button', { name: '+ Porte' }).click();

  await page.getByRole('button', { name: 'Calculer mon estimation' }).click();
  await expect(page.getByRole('heading', { name: 'Votre estimation' })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole('button', { name: 'Sauvegarder mon projet' }).click();

  // Aucune session au départ : l'ouverture de session, la synchronisation du
  // compte et la migration du brouillon tiennent dans ce seul clic.
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  await expect(
    page.getByRole('heading', { name: 'Mes projets' }),
  ).toBeVisible();

  expect(createdProjectId).not.toBeNull();

  // Le brouillon a été adopté : plus rien en local. C'est ce qui empêche le
  // tableau de bord d'afficher en même temps une liste API vide et une carte de
  // brouillon — la double section constatée.
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), DRAFTS_KEY), {
      timeout: 15_000,
    })
    .toBeNull();

  const projectCard = page.locator('article', {
    hasText: 'Mon projet peinture',
  });
  await expect(projectCard).toHaveCount(1);

  // Une seule entrée dans le parcours : le bouton de la carte API, jamais un
  // second qui pointerait vers un uuid local.
  const openDimensions = page.getByRole('button', {
    name: /dimensions/i,
  });
  await expect(openDimensions).toHaveCount(1);
  await openDimensions.click();

  await page.waitForURL(`**/projects/${createdProjectId}/dimensions`, {
    timeout: 30_000,
  });

  // Le squelette perpétuel se voyait exactement ici : ce titre n'arrivait jamais.
  await expect(
    page.getByRole('heading', { name: 'Dimensions de la pièce' }),
  ).toBeVisible({ timeout: 20_000 });

  await expect(page.getByLabel('Longueur (m)')).toHaveValue('4');
  await expect(page.getByLabel('Largeur (m)')).toHaveValue('3');
  await expect(page.getByLabel('Hauteur (m)')).toHaveValue('2.5');
  // L'ouverture a voyagé elle aussi : la migration rejoue le brouillon entier,
  // pas seulement ses trois mesures.
  await expect(
    page.getByRole('button', { name: 'Supprimer Porte 1' }),
  ).toBeVisible();
});
