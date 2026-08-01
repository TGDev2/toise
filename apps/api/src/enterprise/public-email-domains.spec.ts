import {
  domainOfEmail,
  isPublicEmailDomain,
  normalizeDomain,
} from './public-email-domains';

describe('normalizeDomain — surface de rattachement SSO (BACKLOG PLAT-6 D4)', () => {
  it.each([
    ['ACME.COM', 'acme.com'],
    ['  acme.fr  ', 'acme.fr'],
    ['acme.com.', 'acme.com'],
    ['sub.acme.co.uk', 'sub.acme.co.uk'],
  ])('normalise « %s » en « %s »', (raw, expected) => {
    expect(normalizeDomain(raw)).toBe(expected);
  });

  it.each([
    ['fr', 'un TLD nu capterait tout un pays'],
    ['', 'chaîne vide'],
    ['acme', 'pas de point'],
    ['-acme.com', 'tiret en tête'],
    ['acme-.com', 'tiret en fin de label'],
    ['acme..com', 'label vide'],
    ['acme .com', 'espace interne'],
  ])('refuse « %s » (%s)', (raw) => {
    expect(normalizeDomain(raw)).toBeNull();
  });

  it('refuse un domaine au-delà de la longueur stockable', () => {
    expect(normalizeDomain(`${'a'.repeat(300)}.com`)).toBeNull();
  });
});

describe('isPublicEmailDomain', () => {
  it.each(['gmail.com', 'orange.fr', 'outlook.com', 'icloud.com', 'yahoo.fr'])(
    'reconnaît le domaine grand public %s',
    (domain) => {
      expect(isPublicEmailDomain(domain)).toBe(true);
    },
  );

  it.each(['acme.com', 'chiffreo.fr', 'mail.acme.com'])(
    'laisse passer le domaine d’entreprise %s',
    (domain) => {
      expect(isPublicEmailDomain(domain)).toBe(false);
    },
  );
});

describe('domainOfEmail', () => {
  it('extrait et normalise la partie droite', () => {
    expect(domainOfEmail('Jean.Dupont@ACME.COM')).toBe('acme.com');
  });

  it('prend le dernier « @ », pas le premier', () => {
    expect(domainOfEmail('a@b@acme.com')).toBe('acme.com');
  });

  it.each(['sansarobase', '@acme.com', 'jean@', 'jean@fr'])(
    'refuse « %s »',
    (email) => {
      expect(domainOfEmail(email)).toBeNull();
    },
  );
});
