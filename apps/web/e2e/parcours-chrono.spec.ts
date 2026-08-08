import { expect, test, type Page } from '@playwright/test';
import {
  Chrono,
  MOBILE,
  answerSelect,
  dimensionsReady,
  measureRoom,
  priceEveryMaterial,
  selectWork,
  signIn,
  workSelectionReady,
} from './helpers';

/**
 * E4-4 — chronométrage du parcours « entrée dans le chantier → devis envoyé ».
 *
 * Ce fichier produit les chiffres de `docs/AUDIT_PARCOURS_10MIN.md`. La
 * méthodologie de mesure et les helpers vivent dans `./helpers.ts`.
 */

/** Fin de parcours commune : liste chiffrée → devis → PDF partagé. */
async function quoteAndSend(chrono: Chrono, page: Page): Promise<void> {
  /*
    E2-4 — le prédicat d'arrivée ne peut plus être « Créer le devis est
    actif » : ce bouton reste désactivé tant que les quantités ne sont pas
    validées. L'attendre actif aurait fait expirer le script sur un écran
    parfaitement sain, et la première réaction aurait été d'accuser le produit.
    L'écran est prêt quand le panneau de validation est là.
  */
  await chrono.advance(
    page.getByRole('button', { name: 'Générer le devis' }),
    'Devis',
    async (p) => {
      await expect(
        p.getByRole('button', { name: 'Je valide ces quantités' }),
      ).toBeEnabled({ timeout: 30_000 });
    },
  );

  /*
    E2-4 — le geste ajouté par ce lot : UN tap pour l'ensemble des lignes, plus
    une décision (relire les quantités). Coût mesuré : 1,2 s + 3 s. La
    validation ligne par ligne existe pour qui corrige, mais elle n'est pas sur
    le chemin nominal — c'est tout l'objet de la contrainte produit.
  */
  chrono.decide(); // relire les quantités avant de les engager
  await chrono.tap(
    page.getByRole('button', { name: 'Je valide ces quantités' }),
  );
  await expect(page.getByRole('button', { name: 'Créer le devis' })).toBeEnabled(
    { timeout: 30_000 },
  );

  // Client, marge, TVA, validité, conditions de règlement : tous pré-remplis ou
  // facultatifs. Restent la lecture du total et la création.
  chrono.decide();
  await chrono.advance(
    page.getByRole('button', { name: 'Créer le devis' }),
    'Envoi',
    async (p) => {
      await expect(
        p.getByRole('button', { name: 'Envoyer le devis' }).first(),
      ).toBeVisible({ timeout: 30_000 });
    },
  );

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    chrono.tap(page.getByRole('button', { name: 'Envoyer le devis' }).first()),
  ]);
  expect(download.suggestedFilename()).toMatch(/^devis-.*\.pdf$/);
}

test.describe('E4-4 — chronométrage du parcours artisan', () => {
  test.use({ viewport: MOBILE });

  test('chantier une pièce, un ouvrage', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);

    const chrono = new Chrono(page);
    chrono.enter('Tableau de bord');

    await chrono.advance(
      page.getByRole('button', { name: /Devis-minute/i }),
      'Mesures',
      dimensionsReady,
    );

    await measureRoom(
      chrono,
      page,
      { length: '4', width: '3', height: '2,5' },
      'Ouvrages',
    );
    await selectWork(chrono, page, ['Peinture murale']);
    await chrono.advance(
      page.getByRole('button', { name: 'Calculer' }),
      'Estimation',
      async (p) => {
        await expect(
          p.getByRole('heading', { name: 'Matériaux nécessaires' }),
        ).toBeVisible({ timeout: 30_000 });
      },
    );

    chrono.decide(); // lire les quantités proposées avant de chiffrer
    await chrono.advance(
      page.getByRole('button', { name: 'Chiffrer les matériaux' }),
      'Prix',
      async (p) => {
        await expect(
          p.getByRole('heading', { name: 'Liste de courses' }),
        ).toBeVisible({ timeout: 30_000 });
      },
    );

    const materialCount = await priceEveryMaterial(chrono, page);
    await quoteAndSend(chrono, page);

    // eslint-disable-next-line no-console
    console.log(`\nMatériaux à chiffrer : ${materialCount}`);
    const total = chrono.report('Scénario 1 — une pièce, un ouvrage');
    expect(total.human + total.machine).toBeLessThan(600);
  });

  /*
    Le nombre de matériaux à chiffrer suit le nombre d'**ouvrages distincts**,
    pas le nombre de pièces (le moteur mutualise). Ce scénario est donc le seul
    des trois qui mette l'étape « Prix » à sa vraie taille : une salle d'eau
    peinte et carrelée. Le carrelage sol porte en prime les deux seules
    questions contextuelles obligatoires du catalogue.
  */
  test('chantier une pièce, trois ouvrages dont carrelage', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);

    const chrono = new Chrono(page);
    chrono.enter('Tableau de bord');

    await chrono.advance(
      page.getByRole('button', { name: /Devis-minute/i }),
      'Mesures',
      dimensionsReady,
    );

    await measureRoom(
      chrono,
      page,
      { length: '3', width: '2,4', height: '2,5' },
      'Ouvrages',
    );
    await selectWork(chrono, page, [
      'Peinture murale',
      'Peinture plafond',
      'Carrelage sol',
    ]);
    await answerSelect(chrono, page, /format du carreau/i, '30x60');
    // E1-5 — troisième question du carrelage sol : la largeur de joint. Elle
    // coûte un tap de plus, et c'est le seul geste que ce lot ajoute au
    // parcours. « auto » est la réponse attendue par défaut : le moteur retient
    // la largeur recommandée pour le format choisi.
    await answerSelect(chrono, page, /largeur de joint/i, 'auto');
    await answerSelect(chrono, page, /type de pose/i, 'straight');
    /*
      E1-10 — les deux questions qui décident du système d'étanchéité et du
      ragréage. Elles sont obligatoires depuis leur arrivée et le script n'y
      répondait pas : « Calculer » ne naviguait plus, et ce scénario ne mesurait
      donc plus rien depuis ce lot-là. Leur coût — deux taps, deux décisions —
      appartient à E1-10, pas à E2-4.
    */
    await answerSelect(chrono, page, /exposition à l'eau/i, 'dry');
    await answerSelect(chrono, page, /planéité du support/i, 'flat');
    await chrono.advance(
      page.getByRole('button', { name: 'Calculer' }),
      'Estimation',
      async (p) => {
        await expect(
          p.getByRole('heading', { name: 'Matériaux nécessaires' }),
        ).toBeVisible({ timeout: 30_000 });
      },
    );

    chrono.decide();
    await chrono.advance(
      page.getByRole('button', { name: 'Chiffrer les matériaux' }),
      'Prix',
      async (p) => {
        await expect(
          p.getByRole('heading', { name: 'Liste de courses' }),
        ).toBeVisible({ timeout: 30_000 });
      },
    );

    const materialCount = await priceEveryMaterial(chrono, page);
    await quoteAndSend(chrono, page);

    // eslint-disable-next-line no-console
    console.log(`\nMatériaux à chiffrer : ${materialCount}`);
    const total = chrono.report(
      'Scénario 3 — une pièce, trois ouvrages dont carrelage',
    );
    expect(total.human + total.machine).toBeLessThan(600);
  });

  test('chantier trois pièces, deux ouvrages', async ({ page }) => {
    test.setTimeout(300_000);
    await signIn(page);

    const chrono = new Chrono(page);
    chrono.enter('Tableau de bord');

    await chrono.advance(
      page.getByRole('button', { name: /Devis-minute/i }),
      'Mesures — pièce 1',
      dimensionsReady,
    );

    const rooms = [
      { length: '4', width: '3', height: '2,5' },
      { length: '3,5', width: '2,8', height: '2,5' },
      { length: '2,2', width: '1,8', height: '2,5' },
    ];

    /*
      Les ouvrages sont enregistrés **par pièce** (`POST /work-items?room=…`) :
      un chantier de trois pièces traverse donc trois fois les étapes Mesures et
      Travaux, et « Calculer » éjecte à chaque fois vers l'estimation. Mesurer
      les trois pièces d'affilée puis choisir les ouvrages une seule fois
      produirait un devis ne couvrant qu'une pièce — c'est exactement ce que
      fait une première version de ce script, et le devis sortait faux sans un
      mot. Le parcours mesuré ci-dessous est le seul qui donne un devis juste.
    */
    for (let i = 0; i < rooms.length; i += 1) {
      const last = i === rooms.length - 1;
      await measureRoom(chrono, page, rooms[i], `Ouvrages — pièce ${i + 1}`);
      await selectWork(chrono, page, ['Peinture murale', 'Peinture plafond']);
      await chrono.advance(
        page.getByRole('button', { name: 'Calculer' }),
        last ? 'Estimation' : `Estimation (traversée, pièce ${i + 1})`,
        async (p) => {
          await expect(
            p.getByRole('heading', { name: 'Matériaux nécessaires' }),
          ).toBeVisible({ timeout: 30_000 });
        },
      );
      if (last) break;

      // Retour complet jusqu'à l'étape Mesures pour la pièce suivante : aucune
      // sortie d'étape ne propose « pièce suivante ».
      await chrono.advance(
        page.getByRole('link', { name: "Retour à l'étape Travaux" }),
        `Retour Travaux — pièce ${i + 2}`,
        workSelectionReady,
      );
      await chrono.advance(
        page.getByRole('link', { name: "Retour à l'étape Mesures" }),
        `Retour Mesures — pièce ${i + 2}`,
        dimensionsReady,
      );
      await chrono.advance(
        page.getByRole('button', { name: '+ Ajouter une pièce' }),
        `Mesures — pièce ${i + 2}`,
        async (p) => {
          await expect(p.getByLabel('Longueur (m)')).toHaveValue('', {
            timeout: 20_000,
          });
        },
      );
    }

    chrono.decide();
    await chrono.advance(
      page.getByRole('button', { name: 'Chiffrer les matériaux' }),
      'Prix',
      async (p) => {
        await expect(
          p.getByRole('heading', { name: 'Liste de courses' }),
        ).toBeVisible({ timeout: 30_000 });
      },
    );

    const materialCount = await priceEveryMaterial(chrono, page);
    await quoteAndSend(chrono, page);

    // eslint-disable-next-line no-console
    console.log(`\nMatériaux à chiffrer : ${materialCount}`);
    const total = chrono.report('Scénario 2 — trois pièces, deux ouvrages');
    expect(total.human + total.machine).toBeLessThan(600);
  });

  /*
    E1-4 — la cloison sèche est le seul ouvrage à assiette déclarée du
    catalogue : linéaire, hauteur, faces à parementer. La hauteur n'est
    volontairement **pas** ressaisie ci-dessous — le préremplissage depuis la
    hauteur de la pièce (2,5 m, saisie par `measureRoom`) est ce que ce
    scénario prouve. Un seul geste de plus que le scénario 1 (le linéaire) et
    une décision (les faces), pour un ouvrage qui change radicalement de
    parcours de saisie par rapport aux six ouvrages de recouvrement.
  */
  test('chantier une pièce, cloison 4 ml', async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page);

    const chrono = new Chrono(page);
    chrono.enter('Tableau de bord');

    await chrono.advance(
      page.getByRole('button', { name: /Devis-minute/i }),
      'Mesures',
      dimensionsReady,
    );

    await measureRoom(
      chrono,
      page,
      { length: '4', width: '3', height: '2,5' },
      'Ouvrages',
    );
    await selectWork(chrono, page, ['Cloison seche']);
    await chrono.fillNumber(page.getByLabel('Linéaire à créer (m)'), '4');
    await chrono.tap(page.getByLabel('Cloison, deux faces'), {
      decision: true,
    });
    await chrono.advance(
      page.getByRole('button', { name: 'Calculer' }),
      'Estimation',
      async (p) => {
        await expect(
          p.getByRole('heading', { name: 'Matériaux nécessaires' }),
        ).toBeVisible({ timeout: 30_000 });
      },
    );

    chrono.decide(); // lire les quantités proposées avant de chiffrer
    await chrono.advance(
      page.getByRole('button', { name: 'Chiffrer les matériaux' }),
      'Prix',
      async (p) => {
        await expect(
          p.getByRole('heading', { name: 'Liste de courses' }),
        ).toBeVisible({ timeout: 30_000 });
      },
    );

    const materialCount = await priceEveryMaterial(chrono, page);
    await quoteAndSend(chrono, page);

    // eslint-disable-next-line no-console
    console.log(`\nMatériaux à chiffrer : ${materialCount}`);
    const total = chrono.report('Scénario 4 — cloison 4 ml');
    expect(total.human + total.machine).toBeLessThan(600);
  });
});
