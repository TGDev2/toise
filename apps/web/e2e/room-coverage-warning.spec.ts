import { expect, test } from '@playwright/test';
import {
  Chrono,
  dimensionsReady,
  measureRoom,
  priceEveryMaterial,
  selectWork,
  signIn,
  workSelectionReady,
} from './parcours-chrono.spec';

const MOBILE = { width: 390, height: 844 };

/**
 * E2-5 — le parcours multi-pièces se trompe silencieusement si on l'aborde
 * autrement que `parcours-chrono.spec.ts` : mesurer trois pièces d'affilée
 * puis choisir les ouvrages une seule fois produit un devis qui ne couvre
 * qu'une pièce, sans le moindre avertissement (`docs/AUDIT_PARCOURS_10MIN.md`
 * §3.3). Ce test emprunte exactement ce chemin fautif et vérifie que le
 * bandeau de couverture le signale, nomme les pièces manquantes, et que le
 * dismiss ne le fait pas réapparaître à chaque écran.
 */
test.describe('E2-5 — avertissement de couverture multi-pièces', () => {
  test.use({ viewport: MOBILE });

  test('signale les deux pièces mesurées sans ouvrage, et retient le dismiss', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await signIn(page);

    const chrono = new Chrono(page);
    chrono.enter('Tableau de bord');

    await chrono.advance(
      page.getByRole('button', { name: /Devis-minute/i }),
      'Mesures — pièce 1',
      dimensionsReady,
    );

    const projectId = new URL(page.url()).pathname.split('/')[2];

    // Pièce 1 : mesurée ET ouvragée — la seule pièce que le devis doit couvrir.
    await measureRoom(
      chrono,
      page,
      { length: '4', width: '3', height: '2,5' },
      'Ouvrages — pièce 1',
    );
    await selectWork(chrono, page, ['Peinture murale']);
    await chrono.advance(
      page.getByRole('button', { name: 'Calculer' }),
      'Estimation (traversée, pièce 1)',
      async (p) => {
        await expect(
          p.getByRole('heading', { name: 'Matériaux nécessaires' }),
        ).toBeVisible({ timeout: 30_000 });
      },
    );

    // Retour jusqu'aux dimensions de la pièce 1 pour ajouter la pièce 2 —
    // seul chemin qui expose « + Ajouter une pièce » (RoomSwitcher n'est câblé
    // qu'à l'étape dimensions, pas à l'étape travaux).
    await chrono.advance(
      page.getByRole('link', { name: "Retour à l'étape Travaux" }),
      'Retour Travaux — pièce 2',
      workSelectionReady,
    );
    await chrono.advance(
      page.getByRole('link', { name: "Retour à l'étape Mesures" }),
      'Retour Mesures — pièce 2',
      dimensionsReady,
    );
    await chrono.advance(
      page.getByRole('button', { name: '+ Ajouter une pièce' }),
      'Mesures — pièce 2',
      async (p) => {
        await expect(p.getByLabel('Longueur (m)')).toHaveValue('', {
          timeout: 20_000,
        });
      },
    );

    // Pièce 2 : mesurée, JAMAIS ouvragée — c'est le chemin fautif.
    await measureRoom(
      chrono,
      page,
      { length: '3,5', width: '2,8', height: '2,5' },
      'Ouvrages — pièce 2',
    );
    await chrono.advance(
      page.getByRole('link', { name: "Retour à l'étape Mesures" }),
      'Retour Mesures — pièce 3',
      dimensionsReady,
    );
    await chrono.advance(
      page.getByRole('button', { name: '+ Ajouter une pièce' }),
      'Mesures — pièce 3',
      async (p) => {
        await expect(p.getByLabel('Longueur (m)')).toHaveValue('', {
          timeout: 20_000,
        });
      },
    );

    // Pièce 3 : mesurée, JAMAIS ouvragée non plus.
    await measureRoom(
      chrono,
      page,
      { length: '2,2', width: '1,8', height: '2,5' },
      'Ouvrages — pièce 3',
    );

    // L'artisan passe directement au chiffrage sans revenir sur les pièces 2
    // et 3 — exactement le geste que l'audit décrit.
    await page.goto(`/projects/${projectId}/estimate`);
    await expect(
      page.getByRole('heading', { name: 'Matériaux nécessaires' }),
    ).toBeVisible({ timeout: 30_000 });

    const warning = page.getByText('Ce chantier compte des pièces non prises en compte');
    await expect(warning).toBeVisible();
    await expect(page.getByText(/Pièce 2, Pièce 3/)).toBeVisible();
    await expect(page.getByText(/Ce chiffrage couvre : Pièce 1\./)).toBeVisible();

    await page
      .getByRole('button', { name: 'Ignorer cet avertissement' })
      .click();
    await expect(warning).toBeHidden();

    // Chiffrage et devis : l'avertissement ne bloque rien.
    await page.getByRole('button', { name: 'Chiffrer les matériaux' }).click();
    await expect(
      page.getByRole('heading', { name: 'Liste de courses' }),
    ).toBeVisible({ timeout: 30_000 });
    await priceEveryMaterial(chrono, page);

    await page.getByRole('button', { name: 'Générer le devis' }).click();
    await expect(
      page.getByRole('button', { name: 'Je valide ces quantités' }),
    ).toBeEnabled({ timeout: 30_000 });

    // Le dismiss est retenu par projet + empreinte des pièces manquantes, pas
    // par écran : même situation non résolue depuis l'étape Estimation, le
    // bandeau ne réapparaît pas ici — c'est ce que « conservé pour ne pas le
    // réafficher à chaque écran » veut dire.
    await expect(
      page.getByText('Ce chantier compte des pièces non prises en compte'),
    ).toBeHidden();

    chrono.decide();
    await page.getByRole('button', { name: 'Je valide ces quantités' }).click();
    await expect(
      page.getByRole('button', { name: 'Créer le devis' }),
    ).toBeEnabled({ timeout: 30_000 });
  });
});
