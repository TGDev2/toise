import { expect, test, type Page } from '@playwright/test';
import { FREE_EMAIL, FREE_PASSWORD } from './fixtures';
import {
  Chrono,
  MOBILE,
  PAYWALL,
  acceptCookies,
  expectNoPaywall,
  selectWork,
  signIn,
} from './helpers';

/**
 * E3-2 — le contrat du palier gratuit, parcouru de bout en bout.
 *
 * **Ce que ce test prouve, et qu'aucun autre étage ne peut prouver.** Les gates
 * sont résolues côté client à partir d'une table lue par un appel authentifié
 * (`FeatureGateContext`), et le mécanisme est fail-closed : une ligne absente
 * de `feature_gates` ou un `min_tier` remonté ne lève aucune erreur — il rend
 * `false`, et un cadenas remplace l'icône euro. Les tests unitaires web
 * mockent ce contexte ; les `*.e2e-spec.ts` de l'API mockent le service. Seul
 * un vrai navigateur, sur un vrai compte gratuit, contre une vraie base, peut
 * dire ce que voit l'utilisateur.
 *
 * **La sentinelle est une assertion d'absence, donc elle porte sur un marqueur
 * qui existe** (`data-testid="paywall-modal"`, posé sur les deux racines de
 * paywall). Une absence assertée sur un texte — « Créez votre compte gratuit »
 * — deviendrait muette le jour où ce texte change, sans que rien ne le signale.
 *
 * **La frontière payante est vérifiée dans les deux sens.** Un test qui ne
 * regarderait que l'absence de paywall passerait aussi sur un produit devenu
 * entièrement gratuit. Le parcours vérifie donc aussi que l'export PDF de la
 * liste d'achats est bien là (gratuit) et que « Générer le devis » n'y est pas
 * (`export_devis` reste payant).
 */

const PROJECT_NAME = 'Chantier gratuit E2E';

/**
 * Le compte gratuit est réutilisé d'une exécution à l'autre et son quota de
 * projets est désormais illimité : les chantiers s'accumulent. On repart donc
 * d'un projet neuf, et on le nomme, pour que l'échec désigne le bon.
 */
async function startProject(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Créer un projet' }).click();
  await page.getByLabel('Nom du projet').fill(PROJECT_NAME);
  await page.getByLabel('Pièce concernée').fill('Salon');
  await page
    .getByRole('button', { name: 'Continuer vers les dimensions' })
    .click();
}

test.use({ viewport: MOBILE });

test('un compte gratuit va de l’accueil à la liste d’achat chiffrée sans un seul paywall', async ({
  page,
}) => {
  test.setTimeout(180_000);

  // ── Accueil ──────────────────────────────────────────────────────────────
  await page.goto('/');
  await acceptCookies(page);
  await expectNoPaywall(page, 'accueil');

  await signIn(page, FREE_EMAIL, FREE_PASSWORD);
  await expect(page.getByRole('button', { name: 'Créer un projet' })).toBeVisible(
    { timeout: 20_000 },
  );
  await expectNoPaywall(page, 'tableau de bord');

  // ── Création du chantier ─────────────────────────────────────────────────
  // La limite de deux projets a disparu (E3-2) : cette création doit passer
  // quel que soit l'historique du compte, et sans réveiller le paywall
  // `unlimited_projects` que le tableau de bord ouvrait sur
  // `PROJECT_LIMIT_REACHED`.
  await startProject(page);
  await expect(
    page.getByRole('heading', { name: 'Dimensions de la pièce' }),
  ).toBeVisible({ timeout: 20_000 });
  await expectNoPaywall(page, 'création du chantier');

  // ── Dimensions, avec une ouverture ───────────────────────────────────────
  await page.getByLabel('Longueur (m)').fill('4');
  await page.getByLabel('Largeur (m)').fill('3');
  await page.getByLabel('Hauteur (m)').fill('2.5');
  await page.getByRole('button', { name: '+ Porte' }).click();
  await page.getByRole('button', { name: 'Enregistrer les dimensions' }).click();

  await expect(
    page.getByRole('heading', { name: 'Sélection des travaux' }),
  ).toBeVisible({ timeout: 20_000 });
  await expectNoPaywall(page, 'dimensions');

  // ── Ouvrages et niveau ───────────────────────────────────────────────────
  /*
    `selectWork` plutôt qu'un clic direct sur la tuile, et ce n'est pas un
    détail de style : l'écran **reprend les ouvrages du dernier chantier**
    (« Repris de votre dernier chantier — modifiable »). Comme le compte gratuit
    est réutilisé d'une exécution à l'autre — il n'a plus de limite de chantiers
    à purger — la tuile est déjà cochée au deuxième passage, et un clic la
    *décoche*. Le scénario échouait alors deux écrans plus loin, sur
    « Matériaux nécessaires » introuvable, sans jamais nommer sa cause. Le
    helper amène l'écran à l'état visé (leçon 23).

    « Confirmé » : le niveau pilote les facteurs de perte par pose et par niveau
    (`advanced_loss_factors`), que ce lot range dans le chiffrage gratuit — un
    parcours resté au niveau par défaut ne les traverserait pas. `selectWork`
    le pose lui aussi.
  */
  const chrono = new Chrono(page);
  chrono.enter('Travaux'); // `selectWork` compte ses gestes ; on jette le relevé.
  await selectWork(chrono, page, ['Peinture murale']);
  await page.getByRole('button', { name: 'Calculer' }).click();

  await expect(
    page.getByRole('heading', { name: 'Matériaux nécessaires' }),
  ).toBeVisible({ timeout: 30_000 });
  await expectNoPaywall(page, 'estimation');

  // ── Liste d'achat ────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Voir la liste de courses' }).click();
  await expect(
    page.getByRole('heading', { name: 'Liste de courses' }),
  ).toBeVisible({ timeout: 20_000 });
  await expectNoPaywall(page, 'liste de courses');

  // ── Saisie des prix ──────────────────────────────────────────────────────
  /*
    C'est le geste que l'énoncé d'E3-2 désigne : l'icône euro d'une ligne
    (`ShoppingListMaterials`). Quand `budget_tracking` est refusée, le bouton
    reste présent et cliquable mais devient un **cadenas** qui ouvre le paywall
    au lieu des champs. Constater l'absence de paywall ne suffirait donc pas :
    on exige que les champs de prix s'ouvrent réellement.
  */
  const priceButtons = page.getByRole('button', { name: 'Saisir le prix réel' });
  const lines = await priceButtons.count();
  expect(lines).toBeGreaterThan(0);

  await expect(priceButtons.first()).toHaveAttribute(
    'title',
    'Saisir le prix réel',
  );

  let pricePatched = false;
  page.on('response', (res) => {
    if (
      res.request().method() === 'PATCH' &&
      res.url().includes('/shopping-list') &&
      res.ok()
    ) {
      pricePatched = true;
    }
  });

  for (let i = 0; i < lines; i += 1) {
    await priceButtons.nth(i).click();
    const input = page.getByLabel('Prix unitaire').nth(i);
    await expect(
      input,
      "Le champ de prix ne s'est pas ouvert : `budget_tracking` est refusée à un compte gratuit.",
    ).toBeVisible({ timeout: 10_000 });
    await input.fill(String(12 + i));
    await input.blur();
    await expectNoPaywall(page, `saisie du prix, ligne ${i + 1}`);
  }

  // L'enregistrement est débattu à 300 ms et réarmé à chaque frappe.
  await expect
    .poll(() => pricePatched, { timeout: 10_000 })
    .toBe(true);

  // Les prix survivent au rechargement : ils ont bien été acceptés par l'API,
  // et pas seulement affichés.
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Liste de courses' }),
  ).toBeVisible({ timeout: 20_000 });
  await expectNoPaywall(page, 'liste de courses rechargée');

  // ── La frontière payante, dans les deux sens ─────────────────────────────
  // Gratuit : l'export PDF de la liste d'achats est offert au palier gratuit
  // (aucune gate ne le garde, seul `RegisteredAccountGuard` le réserve aux
  // comptes inscrits — ce compte en est un).
  await expect(page.getByRole('button', { name: 'Télécharger PDF' })).toBeVisible();

  // Payant : `export_devis` reste au palier `contractor_essentiel`. La sortie
  // vers le devis n'est donc pas offerte, et c'est la seule chose qui manque au
  // bout de ce parcours.
  await expect(
    page.getByRole('button', { name: 'Générer le devis' }),
    "« Générer le devis » est offert à un compte gratuit : `export_devis` a quitté le palier payant.",
  ).toHaveCount(0);

  // Bilan : zéro paywall, du premier écran au dernier.
  await expect(page.locator(PAYWALL)).toHaveCount(0);
});
