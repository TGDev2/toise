import { expect, test, type Locator, type Page } from '@playwright/test';
import { ARTISAN_EMAIL, ARTISAN_PASSWORD } from './fixtures';

/**
 * E4-4 — chronométrage du parcours « entrée dans le chantier → devis envoyé ».
 *
 * Ce fichier produit les chiffres de `docs/AUDIT_PARCOURS_10MIN.md`. Deux
 * grandeurs, jamais mélangées :
 *
 * 1. **Temps machine** — mesuré. Le délai entre le geste qui quitte un écran et
 *    le moment où le suivant est utilisable (réseau + rendu). C'est ce que le
 *    produit contrôle directement.
 * 2. **Temps humain** — modélisé, à partir des gestes *réellement comptés* par
 *    le script et du barème `COST` ci-dessous. Un robot tape en 0 ms ; mesurer
 *    sa frappe ne dirait rien d'un artisan debout chez son client.
 *
 * Les scrolls ne sont pas estimés : avant chaque geste, le script lit la
 * position de la cible dans le viewport de 844 px et compte un scroll quand
 * elle en sort. C'est la mesure qui atteste que `StickyActionBar` et
 * `FlowProgress` gardent les actions sous le pouce.
 *
 * Les assertions portent sur les **gestes**, pas sur les secondes : une horloge
 * est instable en CI, un nombre de taps ne l'est pas. Un correctif qui retire
 * un geste fait donc évoluer ce test — c'est le but : le chiffre du rapport et
 * le code ne peuvent plus diverger en silence.
 */

const MOBILE = { width: 390, height: 844 };

/**
 * Barème de coût humain, en secondes. Valeurs conservatrices, pour un artisan
 * debout, une main sur le téléphone.
 */
const COST = {
  /** Viser et toucher une cible de 44 px. */
  tap: 1.2,
  /** Focus + frappe d'un nombre court au pavé décimal. */
  typeNumber: 4,
  /** Lire une question et choisir (ouvrage, niveau, prix d'un matériau…). */
  decide: 3,
  /** Faire défiler jusqu'à une cible hors champ, puis la retrouver. */
  scroll: 1.5,
} as const;

interface ScreenRecord {
  screen: string;
  taps: number;
  typedFields: number;
  decisions: number;
  scrolls: number;
  /** Temps machine des transitions déclenchées depuis cet écran. */
  machineMs: number;
}

class Chrono {
  private readonly records: ScreenRecord[] = [];
  private current: ScreenRecord | null = null;

  constructor(private readonly page: Page) {}

  enter(screen: string): void {
    this.current = {
      screen,
      taps: 0,
      typedFields: 0,
      decisions: 0,
      scrolls: 0,
      machineMs: 0,
    };
    this.records.push(this.current);
  }

  private get screen(): ScreenRecord {
    if (!this.current) throw new Error('Chrono.enter() n’a pas été appelé.');
    return this.current;
  }

  /**
   * Compte un scroll quand la cible est hors du viewport *avant* l'interaction :
   * Playwright fait défiler tout seul, l'artisan non.
   */
  private async countScrollIfOffscreen(locator: Locator): Promise<void> {
    const box = await locator.boundingBox();
    const viewport = this.page.viewportSize();
    if (!box || !viewport) return;
    if (box.y < 0 || box.y + box.height > viewport.height) {
      this.screen.scrolls += 1;
    }
  }

  async tap(locator: Locator, options?: { decision?: boolean }): Promise<void> {
    await ensureVisible(locator);
    await this.countScrollIfOffscreen(locator);
    this.screen.taps += 1;
    if (options?.decision) this.screen.decisions += 1;
    await locator.click();
  }

  async fillNumber(locator: Locator, value: string): Promise<void> {
    await ensureVisible(locator);
    await this.countScrollIfOffscreen(locator);
    this.screen.typedFields += 1;
    await locator.fill(value);
  }

  /** Un choix pris sans geste supplémentaire (lire un écran, vérifier un total). */
  decide(count = 1): void {
    this.screen.decisions += count;
  }

  /**
   * Geste qui fait basculer d'écran : mesure le temps machine jusqu'à ce que
   * l'écran suivant soit utilisable, puis ouvre le compteur du nouvel écran.
   */
  async advance(
    trigger: Locator,
    nextScreen: string,
    ready: (page: Page) => Promise<void>,
  ): Promise<void> {
    await ensureVisible(trigger);
    await this.countScrollIfOffscreen(trigger);
    this.screen.taps += 1;
    const startedAt = Date.now();
    await trigger.click();
    await ready(this.page);
    this.screen.machineMs += Date.now() - startedAt;
    this.enter(nextScreen);
  }

  private humanSeconds(record: ScreenRecord): number {
    return (
      record.taps * COST.tap +
      record.typedFields * COST.typeNumber +
      record.decisions * COST.decide +
      record.scrolls * COST.scroll
    );
  }

  report(title: string): { human: number; machine: number; taps: number } {
    const lines = [
      '',
      `### ${title}`,
      '',
      '| Écran | Taps | Champs saisis | Décisions | Scrolls | Temps machine | Temps humain modélisé |',
      '|---|---|---|---|---|---|---|',
    ];
    let human = 0;
    let machineMs = 0;
    let taps = 0;
    for (const r of this.records) {
      const h = this.humanSeconds(r);
      human += h;
      machineMs += r.machineMs;
      taps += r.taps;
      lines.push(
        `| ${r.screen} | ${r.taps} | ${r.typedFields} | ${r.decisions} | ${r.scrolls} | ${(r.machineMs / 1000).toFixed(1)} s | ${h.toFixed(1)} s |`,
      );
    }
    const machine = machineMs / 1000;
    lines.push(
      `| **Total** | **${taps}** | | | | **${machine.toFixed(1)} s** | **${human.toFixed(1)} s** |`,
      '',
      `Parcours complet : ${((human + machine) / 60).toFixed(2)} min ` +
        `(humain ${human.toFixed(1)} s + machine ${machine.toFixed(1)} s).`,
      '',
    );
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
    return { human, machine, taps };
  }
}

async function ensureVisible(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 20_000 });
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Accepter' }).click();
  await page.getByLabel('Email').fill(ARTISAN_EMAIL);
  await page.getByLabel('Mot de passe').fill(ARTISAN_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  // Cf. `artisan-devis-minute-pdf.spec.ts` : le cookie `chiffreo_auth` que lit
  // `proxy.ts` est écrit par `onIdTokenChanged`, après la navigation.
  await page.waitForFunction(() => document.cookie.includes('chiffreo_auth'), {
    timeout: 15_000,
  });
  if (new URL(page.url()).pathname !== '/dashboard') {
    await page.goto('/dashboard');
  }
}

const dimensionsReady = async (p: Page): Promise<void> => {
  await expect(
    p.getByRole('heading', { name: 'Dimensions de la pièce' }),
  ).toBeVisible({ timeout: 20_000 });
};

const workSelectionReady = async (p: Page): Promise<void> => {
  await expect(
    p.getByRole('heading', { name: 'Selection des travaux' }),
  ).toBeVisible({ timeout: 20_000 });
};

/** Mesure d'une pièce, depuis l'écran dimensions jusqu'à l'écran ouvrages. */
async function measureRoom(
  chrono: Chrono,
  page: Page,
  dims: { length: string; width: string; height: string },
  nextScreen: string,
): Promise<void> {
  await chrono.fillNumber(page.getByLabel('Longueur (m)'), dims.length);
  await chrono.fillNumber(page.getByLabel('Largeur (m)'), dims.width);
  await chrono.fillNumber(page.getByLabel('Hauteur (m)'), dims.height);
  await chrono.tap(page.getByRole('button', { name: '+ Porte' }));
  await chrono.advance(
    page.getByRole('button', { name: 'Enregistrer les dimensions' }),
    nextScreen,
    workSelectionReady,
  );
}

async function selectWork(
  chrono: Chrono,
  page: Page,
  workTypes: string[],
): Promise<void> {
  for (const label of workTypes) {
    await chrono.tap(page.getByRole('button', { name: label }), {
      decision: true,
    });
  }
  await chrono.tap(page.getByLabel('Confirme'), { decision: true });
}

/** Question contextuelle obligatoire (carrelage sol : format, type de pose). */
async function answerSelect(
  chrono: Chrono,
  page: Page,
  label: RegExp,
  value: string,
): Promise<void> {
  const select = page.getByLabel(label);
  await chrono.tap(select, { decision: true });
  await select.selectOption(value);
}

/**
 * Chiffre **tous** les matériaux, pas seulement le premier : `QuotesService`
 * ne retient que les lignes portant un prix réel, un matériau laissé vide
 * disparaît donc du devis sans un mot.
 */
async function priceEveryMaterial(chrono: Chrono, page: Page): Promise<number> {
  let patches = 0;
  const countPatch = (res: { url(): string; request(): { method(): string } }) => {
    if (
      res.request().method() === 'PATCH' &&
      res.url().includes('/shopping-list')
    ) {
      patches += 1;
    }
  };
  page.on('response', countPatch);

  const priceButtons = page.getByRole('button', { name: 'Saisir le prix reel' });
  const count = await priceButtons.count();
  for (let i = 0; i < count; i += 1) {
    await chrono.tap(priceButtons.nth(i));
    const input = page.getByLabel('Prix unitaire').nth(i);
    await chrono.fillNumber(input, String(12 + i));
    chrono.decide(); // retrouver le prix : étiquette, appli fournisseur, mémoire
    await input.blur();
  }

  /*
    L'enregistrement des prix est débattu à 300 ms et réarmé à chaque saisie :
    rien ne part avant 300 ms après la *dernière*. Sans cette attente, le script
    mesurerait un défaut au lieu du parcours — et ce défaut est réel : sur
    mobile, le tap sur « Générer le devis » est aussi ce qui fait perdre le
    focus au champ, donc la navigation et le déclenchement du `PATCH` sont le
    même geste. Le rapport le traite comme un défaut, pas comme un frottement.
    L'attente est volontairement tolérante : une fois le `PATCH` vidé à la
    sortie de l'étape, aucun `PATCH` ne part plus d'ici et la boucle rend la
    main immédiatement.
  */
  const deadline = Date.now() + 5_000;
  while (patches === 0 && Date.now() < deadline) {
    await page.waitForTimeout(100);
  }
  page.off('response', countPatch);
  return count;
}

/** Fin de parcours commune : liste chiffrée → devis → PDF partagé. */
async function quoteAndSend(chrono: Chrono, page: Page): Promise<void> {
  await chrono.advance(
    page.getByRole('button', { name: 'Générer le devis' }),
    'Devis',
    async (p) => {
      await expect(
        p.getByRole('button', { name: 'Créer le devis' }),
      ).toBeEnabled({ timeout: 30_000 });
    },
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
    await answerSelect(chrono, page, /type de pose/i, 'straight');
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
});
