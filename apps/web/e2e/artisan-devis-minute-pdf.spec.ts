import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { ARTISAN_EMAIL, ARTISAN_PASSWORD } from './fixtures';

/**
 * Parcours artisan connecté : dashboard → devis-minute → dimensions +
 * ouvrage → estimation → prix → génération du devis → export PDF réel.
 * Le compte artisan (palier `contractor_essentiel`, profil entreprise avec
 * taux horaire) est seedé par `global-setup.ts`, pas par ce test.
 */
test('un artisan connecté génère un devis-minute et télécharge le PDF', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Accepter' }).click();

  await page.getByLabel('Email').fill(ARTISAN_EMAIL);
  await page.getByLabel('Mot de passe').fill(ARTISAN_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();

  // La connexion pousse vers /dashboard dès que Firebase confirme la session,
  // sans attendre l'écriture du cookie `chiffreo_auth` que lit le middleware
  // serveur (`proxy.ts`) : le premier essai peut donc rebondir sur /login
  // (gotcha documentée dans la skill verify). Le cookie est écrit dès que
  // `onIdTokenChanged` se déclenche, indépendamment des rebonds éventuels —
  // l'attendre directement est déterministe, contrairement à un nombre fixe
  // de réessais.
  await page.waitForFunction(() => document.cookie.includes('chiffreo_auth'), {
    timeout: 15_000,
  });
  if (new URL(page.url()).pathname !== '/dashboard') {
    await page.goto('/dashboard');
  }

  await expect(page.getByRole('button', { name: /Devis-minute/i })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: /Devis-minute/i }).click();

  // « Devis-minute » crée le chantier et part droit sur les dimensions : l'étape
  // photo (et son bouton « Passer cette étape ») a quitté le tunnel avec le
  // débranchement du service de vision par ordinateur (ADR 0001 D2).
  await expect(page.getByRole('heading', { name: 'Dimensions de la pièce' })).toBeVisible();
  await page.getByLabel('Longueur (m)').fill('4');
  await page.getByLabel('Largeur (m)').fill('3');
  await page.getByLabel('Hauteur (m)').fill('2.5');
  await page.getByRole('button', { name: '+ Porte' }).click();
  await page.getByRole('button', { name: 'Enregistrer les dimensions' }).click();

  await expect(page.getByRole('button', { name: 'Peinture murale' })).toBeVisible();
  await page.getByRole('button', { name: 'Peinture murale' }).click();
  await page.getByLabel('Debutant').check();
  await page.getByRole('button', { name: 'Calculer' }).click();

  await expect(page.getByRole('heading', { name: 'Matériaux nécessaires' })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Chiffrer les matériaux' }).click();

  await expect(page.getByRole('heading', { name: 'Liste de courses' })).toBeVisible();
  await page.getByRole('button', { name: 'Saisir le prix reel' }).first().click();
  const priceInput = page.getByLabel('Prix unitaire').first();
  await priceInput.fill('12.5');
  await priceInput.blur();

  const generateQuoteButton = page.getByRole('button', { name: 'Générer le devis' });
  await expect(generateQuoteButton).toBeEnabled({ timeout: 10_000 });
  await generateQuoteButton.click();

  const createQuoteButton = page.getByRole('button', { name: 'Créer le devis' });
  await expect(createQuoteButton).toBeEnabled({ timeout: 15_000 });
  await createQuoteButton.click();

  const sendPdfButton = page.getByRole('button', { name: 'Envoyer le devis' });
  await expect(sendPdfButton).toBeVisible({ timeout: 15_000 });

  const [download] = await Promise.all([page.waitForEvent('download'), sendPdfButton.click()]);

  expect(download.suggestedFilename()).toMatch(/^devis-.*\.pdf$/);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const { size } = fs.statSync(downloadPath as string);
  expect(size).toBeGreaterThan(0);
});
