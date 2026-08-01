/**
 * Domaines de messagerie grand public, refusés au rattachement SSO (PLAT-6 D4).
 *
 * Le rattachement d'une session ne dépend pas du domaine (D3), donc en admettre
 * un n'ouvrirait aucun accès — mais la **découverte** enverrait tous les porteurs
 * de l'adresse vers l'IdP du client qui l'a déclaré, c'est-à-dire du hameçonnage
 * à grande échelle. Aucun de ces domaines ne peut d'ailleurs être prouvé par DNS
 * : le refus est explicite pour rendre le motif lisible plutôt que de laisser la
 * vérification échouer sans explication.
 */
const PUBLIC_EMAIL_DOMAINS = new Set([
  'aol.com',
  'fastmail.com',
  'free.fr',
  'gmail.com',
  'gmx.com',
  'gmx.net',
  'googlemail.com',
  'hey.com',
  'hotmail.com',
  'hotmail.fr',
  'icloud.com',
  'laposte.net',
  'live.com',
  'live.fr',
  'mail.com',
  'mail.ru',
  'me.com',
  'msn.com',
  'orange.fr',
  'outlook.com',
  'outlook.fr',
  'proton.me',
  'protonmail.com',
  'qq.com',
  'sfr.fr',
  'wanadoo.fr',
  'yahoo.com',
  'yahoo.fr',
  'yandex.com',
  'yandex.ru',
  'zoho.com',
]);

/** Un domaine syntaxiquement plausible : au moins un point, pas de séparateur vide. */
const DOMAIN_PATTERN =
  /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

export function isPublicEmailDomain(domain: string): boolean {
  return PUBLIC_EMAIL_DOMAINS.has(domain);
}

/**
 * Normalise un domaine : minuscules, espaces et point final retirés. Renvoie
 * `null` si le résultat n'est pas un domaine plausible — un TLD nu (« fr ») ou
 * une chaîne vide capteraient sinon bien plus large que prévu.
 */
export function normalizeDomain(raw: string): string | null {
  const domain = raw.trim().toLowerCase().replace(/\.$/, '');
  if (domain.length === 0 || domain.length > 255) return null;
  return DOMAIN_PATTERN.test(domain) ? domain : null;
}

/** Partie droite d'une adresse, normalisée. `null` si l'adresse est inexploitable. */
export function domainOfEmail(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return null;
  return normalizeDomain(email.slice(at + 1));
}
