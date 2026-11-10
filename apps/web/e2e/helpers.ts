import { expect, type Locator, type Page } from '@playwright/test';
import { ARTISAN_EMAIL, ARTISAN_PASSWORD } from './fixtures';

/**
 * Helpers partagés des scénarios navigateur.
 *
 * **Ce fichier n'est pas un `*.spec.ts`, et c'est la raison de son
 * existence.** Ces helpers vivaient dans `parcours-chrono.spec.ts` et
 * `room-coverage-warning.spec.ts` les importait de là ; Playwright interdit
 * l'import entre fichiers de test, si bien que la suite complète refusait de
 * démarrer en un seul appel depuis E2-5 — il fallait la jouer en deux groupes,
 * et un scénario oublié n'aurait fait rougir personne. Un fichier hors du motif
 * `*.spec.ts` n'est pas collecté : les scénarios peuvent le partager.
 *
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

export const MOBILE = { width: 390, height: 844 };

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

export class Chrono {
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

  /** Tap réellement nécessaire à l'artisan, dont le script fait l'économie. */
  countTap(): void {
    this.screen.taps += 1;
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

export async function ensureVisible(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible({ timeout: 20_000 });
}

/**
 * Ouvre une session. Le compte par défaut est l'artisan au palier payant, celui
 * des scénarios historiques ; E3-2 passe le compte **gratuit**, dont le
 * parcours doit être exempt de paywall jusqu'à l'export du devis.
 */
export async function signIn(
  page: Page,
  email: string = ARTISAN_EMAIL,
  password: string = ARTISAN_PASSWORD,
): Promise<void> {
  await page.goto('/login');
  await acceptCookies(page);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  // Cf. `artisan-devis-minute-pdf.spec.ts` : le cookie `toise_auth` que lit
  // `proxy.ts` est écrit par `onIdTokenChanged`, après la navigation.
  await page.waitForFunction(() => document.cookie.includes('toise_auth'), {
    timeout: 15_000,
  });
  if (new URL(page.url()).pathname !== '/dashboard') {
    await page.goto('/dashboard');
  }
}

export const dimensionsReady = async (p: Page): Promise<void> => {
  await expect(
    p.getByRole('heading', { name: 'Dimensions de la pièce' }),
  ).toBeVisible({ timeout: 20_000 });
};

export const workSelectionReady = async (p: Page): Promise<void> => {
  await expect(
    p.getByRole('heading', { name: 'Sélection des travaux' }),
  ).toBeVisible({ timeout: 20_000 });
};

/** Mesure d'une pièce, depuis l'écran dimensions jusqu'à l'écran ouvrages. */
export async function measureRoom(
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

/** Les sept ouvrages du catalogue, dans l'ordre d'affichage des tuiles. */
const ALL_WORK_TYPES = [
  'Peinture murale',
  'Peinture plafond',
  'Carrelage sol',
  'Carrelage mural',
  'Parquet ou stratifie',
  'Cloison seche',
  'Revetement mural',
];

/**
 * Amène l'écran à **exactement** la sélection demandée, et ne compte que les
 * gestes qui restaient à faire. C'est ce qui fait de ce script une mesure du
 * minimum de gestes plutôt que le rejeu d'un parcours figé : quand la reprise
 * du dernier chantier pré-coche les bons ouvrages, le compteur descend seul.
 *
 * Les décochages comptent autant que les cochages : une reprise qui propose un
 * ouvrage dont on ne veut pas coûte un geste, et le chiffre du rapport doit le
 * porter. Sans cela, le scénario 1 héritait des ouvrages du scénario précédent
 * et chiffrait un chantier qu'on ne lui avait pas demandé.
 */
export async function selectWork(
  chrono: Chrono,
  page: Page,
  workTypes: string[],
): Promise<void> {
  const wanted = new Set(workTypes);
  for (const label of ALL_WORK_TYPES) {
    const tile = page.getByRole('button', { name: label });
    await ensureVisible(tile);
    const pressed = (await tile.getAttribute('aria-pressed')) === 'true';
    if (pressed === wanted.has(label)) continue;
    await chrono.tap(tile, { decision: true });
  }
  const expertLevel = page.getByLabel('Confirmé');
  await ensureVisible(expertLevel);
  if (!(await expertLevel.isChecked())) {
    await chrono.tap(expertLevel, { decision: true });
  }
}

/** Question contextuelle obligatoire (carrelage sol : format, type de pose). */
export async function answerSelect(
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
export async function priceEveryMaterial(chrono: Chrono, page: Page): Promise<number> {
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

  const priceButtons = page.getByRole('button', { name: 'Saisir le prix réel' });
  const count = await priceButtons.count();

  /*
    E4-4 — un tap reprend les prix déjà relevés par l'entreprise. Le bouton
    n'existe que s'il a quelque chose à faire ; ce qu'il ne couvre pas se saisit
    ensuite, ligne par ligne, comme avant.
  */
  const recall = page.getByRole('button', {
    name: 'Reprendre mes derniers prix',
  });
  // Les prix connus arrivent après la liste : sans cette attente, le script
  // conclurait « pas de rappel » sur une simple course de réseau — et la mesure
  // dépendrait de la chaleur du serveur de développement.
  await recall.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await recall.isVisible().catch(() => false)) {
    await chrono.tap(recall, { decision: true });
  }

  for (let i = 0; i < count; i += 1) {
    const button = priceButtons.nth(i);
    await ensureVisible(button);
    /*
      Ouverture **non comptée** : elle ne sert qu'au script, pour lire l'état de
      la ligne. Le tap n'est compté que si la ligne réclame vraiment une saisie
      — un artisan dont les prix viennent d'être repris n'ouvre pas ses lignes
      une par une.
    */
    await button.click();
    const input = page.getByLabel('Prix unitaire').nth(i);
    if ((await input.inputValue()) !== '') continue;
    chrono.countTap();
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


/**
 * Amène le bandeau de consentement à l'état « accepté », qu'il soit affiché ou
 * non.
 *
 * Un helper écrit en **suite de gestes** (« clique sur Accepter ») est faux dès
 * qu'un scénario passe par un écran qui l'a déjà accepté : le choix est
 * mémorisé, le bouton ne reparaît pas, et le clic expire au bout de trois
 * minutes sur un produit parfaitement sain. Écrit en **état visé**, il vaut
 * pour tous les points d'entrée (leçon 23).
 */
export async function acceptCookies(page: Page): Promise<void> {
  const accept = page.getByRole('button', { name: 'Accepter' });
  // Le bandeau se monte côté client, après l'hydratation : un `isVisible()`
  // sondé une seule fois juste après `goto` répond « absent » alors qu'il
  // arrive une fraction de seconde plus tard. Le bandeau reste alors en place
  // et intercepte, en `position: fixed`, le premier bouton de bas d'écran —
  // avec un échec qui parle du bouton visé et jamais du bandeau.
  await accept.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {});
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
    await expect(accept).toBeHidden({ timeout: 5_000 });
  }
}

/** Sélecteur des deux racines de paywall (`PaywallModal`). */
export const PAYWALL = '[data-testid="paywall-modal"]';

/**
 * Échoue si un paywall est ouvert, en nommant l'étape.
 *
 * Le message importe : un paywall surgit *pendant* un parcours, et sans le nom
 * de l'écran, l'échec ne dit pas lequel — or c'est toute l'information.
 */
export async function expectNoPaywall(page: Page, step: string): Promise<void> {
  await expect(
    page.locator(PAYWALL),
    `Un paywall s'est ouvert à l'étape « ${step} », avant l'export du devis.`,
  ).toHaveCount(0);
}
