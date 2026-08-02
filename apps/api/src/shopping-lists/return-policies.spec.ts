import {
  RETURN_POLICIES,
  RESTRICTED_CATEGORIES,
  matchReturnPolicy,
  returnDeadline,
} from './return-policies';

/**
 * BACKLOG DATA-5 — ce qui est vérifié ici n'est pas le code, c'est la donnée.
 *
 * Une entrée de `RETURN_POLICIES` est une affirmation publique sur les droits
 * d'un utilisateur. La suite refuse toute entrée qu'un humain ne pourrait pas
 * aller vérifier : la porte par laquelle une valeur devinée entrerait reste
 * fermée par un rouge, pas par une intention.
 */
describe('RETURN_POLICIES — discipline de la donnée', () => {
  it('exige une URL de source sur chaque entrée', () => {
    for (const policy of RETURN_POLICIES) {
      expect(policy.source_url).toMatch(/^https:\/\/\S+\.\S+/);
    }
  });

  it("exige que la source soit le site de l'enseigne, pas un tiers", () => {
    // Un blog de bons plans n'est pas une source : c'est le mode d'entrée
    // typique d'un délai périmé ou inventé.
    const forbidden = /blog|forum|avis|remboursement\.com|mediaseine/i;
    for (const policy of RETURN_POLICIES) {
      expect(policy.source_url).not.toMatch(forbidden);
    }
  });

  it('exige une date de relevé ISO plausible sur chaque entrée', () => {
    for (const policy of RETURN_POLICIES) {
      expect(policy.verified_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const verified = new Date(`${policy.verified_on}T00:00:00Z`);
      expect(Number.isNaN(verified.getTime())).toBe(false);
      expect(verified.getTime()).toBeLessThanOrEqual(Date.now());
    }
  });

  it('exige un délai soit positif, soit explicitement absent', () => {
    for (const policy of RETURN_POLICIES) {
      if (policy.window_days !== null) {
        expect(Number.isInteger(policy.window_days)).toBe(true);
        expect(policy.window_days).toBeGreaterThan(0);
      }
      if (policy.loyalty_window_days !== null) {
        expect(policy.loyalty_window_days).toBeGreaterThanOrEqual(
          policy.window_days ?? 0,
        );
      }
    }
  });

  it('exige au moins une condition et un slug unique', () => {
    const slugs = RETURN_POLICIES.map((policy) => policy.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const policy of RETURN_POLICIES) {
      expect(policy.conditions_fr.length).toBeGreaterThan(0);
      expect(policy.aliases.length).toBeGreaterThan(0);
    }
  });

  it("n'affirme pas le « 30 jours » que le marché croit vrai", () => {
    // Garde-fou de régression sur la prémisse corrigée : quiconque ramènerait
    // Castorama ou Leroy Merlin à 30 jours doit le faire contre un rouge.
    const casto = RETURN_POLICIES.find((p) => p.slug === 'castorama');
    const leroy = RETURN_POLICIES.find((p) => p.slug === 'leroymerlin');
    expect(casto?.window_days).toBe(365);
    expect(leroy?.window_days).toBe(180);
  });
});

describe('matchReturnPolicy', () => {
  it('apparie malgré la casse, les accents et la ponctuation', () => {
    expect(matchReturnPolicy('LEROY MERLIN')?.slug).toBe('leroymerlin');
    expect(matchReturnPolicy('leroy-merlin Ivry')?.slug).toBe('leroymerlin');
    expect(matchReturnPolicy("L'Entrepôt du Bricolage")?.slug).toBe(
      'entrepot-du-bricolage',
    );
    expect(matchReturnPolicy('Casto Lille')?.slug).toBe('castorama');
  });

  it('ne rend rien pour une enseigne inconnue, vide ou absente', () => {
    // Le cas majoritaire en production, et celui qui doit rester muet plutôt
    // que de tomber sur une valeur par défaut.
    expect(matchReturnPolicy('Brico Dépôt')).toBeNull();
    expect(matchReturnPolicy('Mr Bricolage')).toBeNull();
    expect(matchReturnPolicy('quincaillerie du coin')).toBeNull();
    expect(matchReturnPolicy('')).toBeNull();
    expect(matchReturnPolicy(null)).toBeNull();
    expect(matchReturnPolicy(undefined)).toBeNull();
  });

  it("préfère l'alias le plus long quand deux enseignes se recoupent", () => {
    expect(matchReturnPolicy('Leroy Merlin')?.slug).toBe('leroymerlin');
  });
});

describe('returnDeadline', () => {
  const castorama = RETURN_POLICIES.find((p) => p.slug === 'castorama')!;
  const leroy = RETURN_POLICIES.find((p) => p.slug === 'leroymerlin')!;

  it('ajoute le délai de base au jour d’achat', () => {
    expect(returnDeadline(leroy, '2026-08-02')).toBe('2027-01-29');
    expect(returnDeadline(castorama, '2026-08-02')).toBe('2027-08-02');
  });

  it('retient le délai de base, jamais celui de la fidélité', () => {
    // 180 jours et non 365 : annoncer l'échéance longue à qui n'a pas la carte
    // est la seule des deux erreurs qui coûte de l'argent à l'utilisateur.
    expect(returnDeadline(leroy, '2026-01-01')).toBe('2026-06-30');
  });

  it('rend null sur une date invalide plutôt qu’une échéance fantaisiste', () => {
    expect(returnDeadline(castorama, 'pas-une-date')).toBeNull();
  });

  it('rend null quand l’enseigne ne publie aucun délai fixe', () => {
    expect(
      returnDeadline({ ...castorama, window_days: null }, '2026-08-02'),
    ).toBeNull();
  });
});

describe('RESTRICTED_CATEGORIES', () => {
  it('couvre la peinture, dont les pots ouverts et teintés ne sont pas repris', () => {
    expect(RESTRICTED_CATEGORIES.painting).toBeDefined();
  });
});
