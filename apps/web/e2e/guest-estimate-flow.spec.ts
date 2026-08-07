import { expect, test } from '@playwright/test';

/**
 * Parcours invité complet (E2-1) : accueil → session invité → dimensions +
 * une ouverture → ouvrage "Peinture murale" + niveau → estimation → liste
 * d'achat. C'est le parcours dont la rupture n'a jamais été détectée avant
 * ce test (E2-6).
 */
test('un invité obtient une estimation et arrive sur une liste d’achat non vide', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Accepter' }).click();

  // La page d'accueil répète le CTA dans plusieurs sections marketing.
  await page.getByRole('button', { name: 'Essayer sans compte' }).first().click();
  await expect(page.getByRole('button', { name: 'Créer un projet' })).toBeVisible();

  await page.getByRole('button', { name: 'Créer un projet' }).click();
  await page.getByLabel('Nom du projet').fill('Salon E2E');
  await page.getByLabel('Pièce concernée').fill('Salon');
  await page.getByRole('button', { name: 'Continuer vers les dimensions' }).click();

  await expect(page.getByRole('heading', { name: 'Dimensions de la pièce' })).toBeVisible();
  await page.getByLabel('Longueur (m)').fill('4');
  await page.getByLabel('Largeur (m)').fill('3');
  await page.getByLabel('Hauteur (m)').fill('2.5');
  await page.getByRole('button', { name: '+ Porte' }).click();
  await page.getByRole('button', { name: 'Enregistrer les dimensions' }).click();

  await expect(page.getByRole('button', { name: 'Peinture murale' })).toBeVisible();
  await page.getByRole('button', { name: 'Peinture murale' }).click();
  // Le libellé affiché porte son accent (`lib/work-types.ts`), contrairement au
  // `label_fr` sans accent des ouvrages seedés. Même correction que celle déjà
  // appliquée à `parcours-chrono`.
  await page.getByRole('radio', { name: 'Débutant' }).check();
  await page.getByRole('button', { name: 'Calculer' }).click();

  await expect(page.getByRole('heading', { name: 'Matériaux nécessaires' })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Voir la liste de courses' }).click();

  await expect(page.getByRole('heading', { name: 'Liste de courses' })).toBeVisible();
  const lineCount = await page.getByRole('spinbutton').count();
  expect(lineCount).toBeGreaterThanOrEqual(1);
  expect(lineCount).toBeLessThanOrEqual(6);
});
