import {
  QUOTE_CHECK_FAQ,
  QUOTE_CHECK_PAGE,
  QUOTE_CHECK_WORK_TYPES,
  QUOTE_COHERENCE_STATUSES,
  QUOTE_COHERENCE_WORDING,
  type QuoteCheckResponse,
  type QuoteCoherenceStatus,
} from '@/lib/quote-check';

/**
 * GTM-10 — le test qui tient la décision produit.
 *
 * § 4.7 de PRODUCT_STRATEGY : **Chiffréo mesure, il n'arbitre pas.** Le produit
 * répond « combien faut-il ? », jamais « est-ce trop cher ? ». Cette décision
 * coûte quelque chose — on renonce au terme de recherche le plus à forte
 * intention — et une décision coûteuse tenue par la seule relecture ne tient pas :
 * il suffit d'une phrase ajoutée un soir pour la défaire.
 *
 * Elle est donc tenue ici, sur la source unique de la formulation
 * (`lib/quote-check.ts`). Le corollaire de la leçon 15 s'applique : un garde-fou
 * ne protège que ce qu'il lit, donc toute phrase de verdict doit passer par ce
 * fichier — l'écrire dans le composant la mettrait hors de portée.
 */

/**
 * Lexique tarifaire. Bornes de mots pour `euro` : « valeur », « couleur » et
 * « meilleur » contiennent la même suite de lettres, et un test qui les rejette
 * serait désarmé le premier jour où il gêne.
 */
const PRICE_LEXICON = [
  /\bprix\b/i,
  /\btarifs?\b/i,
  /\beuros?\b/i,
  /€/,
  /\bmédianes?\b/i,
  /\bmontants?\b/i,
  /\bcoûts?\b/i,
  /\bfacture\b/i,
];

/**
 * Lexique prescriptif : ce qui transforme un constat en jugement. « Ce devis est
 * excessif » peut faire perdre un chantier à une entreprise honnête, sur la foi
 * d'un calcul qui ne connaît ni la contrainte de chantier ni la découpe réelle.
 */
const PRESCRIPTIVE_LEXICON = [
  /trop cher/i,
  /\barnaque/i,
  /\babusi[fv]/i,
  /\bexcessi[fv]/i,
  /surfactur/i,
  /\bcontest(er|ez|ation)/i,
  /\bgonfl(é|e|ement)/i,
  /vous faire avoir/i,
  /\bmalhonnête/i,
];

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((entry) => collectStrings(entry, out));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectStrings(entry, out));
  }
  return out;
}

/** Toute la prose que la page peut afficher, verdicts compris. */
const ALL_COPY = collectStrings([
  QUOTE_COHERENCE_WORDING,
  QUOTE_CHECK_PAGE,
  QUOTE_CHECK_FAQ,
  QUOTE_CHECK_WORK_TYPES,
]);

describe('GTM-10 — le verdict ne parle jamais de prix', () => {
  it('interdit le lexique tarifaire dans toute la prose de la surface', () => {
    const offending = ALL_COPY.filter((text) =>
      PRICE_LEXICON.some((pattern) => pattern.test(text)),
    );
    expect(offending).toEqual([]);
  });

  it('interdit tout champ de prix sur le contrat de réponse', () => {
    // Le contrat est un type : on l'ancre par un objet exhaustif, de sorte que
    // l'ajout d'un champ à `QuoteCheckResponse` casse la compilation ici avant
    // de casser la décision en production.
    const shape: Record<keyof QuoteCheckResponse, true> = {
      work_type_code: true,
      work_type_label: true,
      surface_target: true,
      gross_surface_m2: true,
      net_surface_m2: true,
      deducted_m2: true,
      declared_surface_m2: true,
      implied_waste_percent: true,
      reference: true,
      status: true,
      items: true,
    };

    const forbidden = /prix|price|cost|montant|amount|euro|tarif|median/i;
    expect(Object.keys(shape).filter((key) => forbidden.test(key))).toEqual([]);
  });
});

describe('GTM-10 — le verdict décrit, il ne prescrit pas', () => {
  it('interdit le lexique prescriptif dans toute la prose de la surface', () => {
    const offending = ALL_COPY.filter((text) =>
      PRESCRIPTIVE_LEXICON.some((pattern) => pattern.test(text)),
    );
    expect(offending).toEqual([]);
  });

  it('exige une réserve sur tout verdict qui constate un écart', () => {
    // C'est le garde-fou central : un « au-dessus » lu sans ses causes légitimes
    // est exactement le verdict qui peut nuire à une entreprise honnête.
    const withGap: QuoteCoherenceStatus[] = [
      'above_reference',
      'below_reference',
    ];
    for (const status of withGap) {
      const wording = QUOTE_COHERENCE_WORDING[status];
      expect(wording.caveat).not.toBeNull();
      expect(wording.caveat!.length).toBeGreaterThan(80);
    }
  });

  it('nomme des causes légitimes concrètes sur le verdict « au-dessus »', () => {
    // Une réserve vague (« cela peut varier ») ne protège personne : elle doit
    // citer ce que le calcul ignore, sinon le lecteur retient le seul chiffre.
    const caveat = QUOTE_COHERENCE_WORDING.above_reference.caveat!;
    expect(caveat).toMatch(/découpe/i);
    expect(caveat).toMatch(/chantier/i);
    expect(caveat).toMatch(/calepinage|trame/i);
  });

  it('garde une teinte non alarmante sur les verdicts d’écart', () => {
    expect(QUOTE_COHERENCE_WORDING.above_reference.tone).toBe('attention');
    expect(QUOTE_COHERENCE_WORDING.within_reference.tone).toBe('neutral');
  });
});

describe('GTM-10 — l’union des statuts est fermée des deux côtés', () => {
  it('donne une formulation à chaque statut, sans orpheline', () => {
    expect(Object.keys(QUOTE_COHERENCE_WORDING).sort()).toEqual(
      [...QUOTE_COHERENCE_STATUSES].sort(),
    );
  });

  it('fait porter à chaque formulation le statut sous lequel elle est rangée', () => {
    for (const status of QUOTE_COHERENCE_STATUSES) {
      expect(QUOTE_COHERENCE_WORDING[status].status).toBe(status);
    }
  });

  it('donne un titre et un corps non vides à chaque statut', () => {
    for (const status of QUOTE_COHERENCE_STATUSES) {
      expect(QUOTE_COHERENCE_WORDING[status].headline.trim().length).toBeGreaterThan(0);
      expect(QUOTE_COHERENCE_WORDING[status].body.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('GTM-10 — la limite du contrôle est annoncée, pas découverte', () => {
  it('porte le cas du devis au forfait et la question à poser', () => {
    // L'objection la plus solide contre cette fonctionnalité : beaucoup de devis
    // d'artisan sont forfaitaires, sans quantité, et le contrôle est alors
    // impossible. La page doit le dire d'elle-même.
    expect(QUOTE_CHECK_PAGE.lumpSum.title).toMatch(/forfait/i);
    expect(QUOTE_CHECK_PAGE.lumpSum.ask.length).toBeGreaterThan(80);
  });

  it('dit dans la FAQ que le contrôle ne juge pas le chiffrage', () => {
    const answers = QUOTE_CHECK_FAQ.map((entry) => entry.answer).join(' ');
    expect(answers).toMatch(/main-d’œuvre|main-d'œuvre/i);
    expect(answers).toMatch(/n’est pas une conclusion|pas une conclusion/i);
  });
});

describe('GTM-10 — les ouvrages contrôlables', () => {
  // PUBLIC_WORK_TYPE_CODES (apps/api/src/estimations/dto/public-estimate-request.dto.ts)
  const PUBLIC_CODES = [
    'wall_painting',
    'ceiling_painting',
    'floor_tiling',
    'wall_tiling',
    'parquet_flooring',
  ];

  it('ne propose que des ouvrages que l’API publique accepte', () => {
    for (const workType of QUOTE_CHECK_WORK_TYPES) {
      expect(PUBLIC_CODES).toContain(workType.code);
    }
  });

  it('demande la pose partout où le catalogue sème des poses distinctes', () => {
    // Sans `laying_pattern`, le carrelage n'a aucune ligne applicable et la
    // référence retombe sur le défaut générique de 10 % : le verdict perdrait
    // l'essentiel de sa valeur, en silence.
    for (const code of ['floor_tiling', 'wall_tiling', 'parquet_flooring']) {
      const workType = QUOTE_CHECK_WORK_TYPES.find((w) => w.code === code)!;
      expect(workType.params?.map((p) => p.key)).toContain('laying_pattern');
    }
  });

  it('donne à chaque ouvrage une unité telle qu’elle figure au devis', () => {
    for (const workType of QUOTE_CHECK_WORK_TYPES) {
      expect(workType.unitLabel).toMatch(/m²/);
    }
  });
});
