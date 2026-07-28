import {
  buildIdf,
  idfOf,
  isSpecToken,
  isTokenSatisfied,
  normalizeText,
  tokenize,
} from './text-normalize';

describe('normalizeText', () => {
  it('folds diacritics, apostrophes and superscripts', () => {
    expect(normalizeText('Éponge de carreleur')).toBe('eponge de carreleur');
    expect(normalizeText('Colle en pâte prête à l’emploi')).toBe(
      'colle en pate prete a l emploi',
    );
    expect(normalizeText('Boîte 1,08 m²')).toBe('boite 1.08 m2');
  });

  it('canonicalises French decimals and dimension notation', () => {
    expect(normalizeText('Carrelage 30 x 30 cm')).toBe('carrelage 30x30 cm');
    expect(normalizeText('Carrelage 30×30')).toBe('carrelage 30x30');
    expect(normalizeText('Pot 2,5 L')).toBe('pot 2.5 l');
  });

  it('detaches a unit glued to its number so both notations agree', () => {
    // Le catalogue écrit « 2.6m », le flux marchand « 2,6 m ».
    expect(normalizeText('Lambris PVC couleur 2.6m')).toBe(
      'lambris pvc couleur 2.6 m',
    );
    expect(normalizeText('Lambris PVC blanc 2,6 m')).toBe(
      'lambris pvc blanc 2.6 m',
    );
    expect(normalizeText('Sac 25kg')).toBe('sac 25 kg');
  });

  it('does not split a technical code that ends with digits', () => {
    expect(normalizeText('Plaque BA13')).toBe('plaque ba13');
    expect(normalizeText('Mortier-colle C2S1')).toBe('mortier colle c2s1');
  });
});

describe('tokenize', () => {
  it('drops French stopwords and single characters', () => {
    expect(tokenize("Colle en pâte prête à l'emploi")).toEqual([
      'colle',
      'pate',
      'prete',
      'emploi',
    ]);
  });

  it('keeps technical tokens intact', () => {
    expect(tokenize('Mortier-colle flexible (C2)')).toEqual([
      'mortier',
      'colle',
      'flexible',
      'c2',
    ]);
    expect(tokenize('Carrelage extérieur antidérapant 30x30 cm')).toEqual([
      'carrelage',
      'exterieur',
      'antiderapant',
      '30x30',
      'cm',
    ]);
  });

  it('yields the same numeric token for both unit notations', () => {
    expect(tokenize('Lambris PVC couleur 2.6m')).toContain('2.6');
    expect(tokenize('Lambris PVC blanc 2,6 m lot de 5')).toContain('2.6');
  });
});

describe('isSpecToken', () => {
  it('flags tokens carrying a digit', () => {
    expect(isSpecToken('30x30')).toBe(true);
    expect(isSpecToken('c2')).toBe(true);
    expect(isSpecToken('2.5')).toBe(true);
    expect(isSpecToken('acrylique')).toBe(false);
  });
});

describe('isTokenSatisfied', () => {
  const productTokens = new Set(
    tokenize('Mortier colle C2S1 flexible 25 kg Weber'),
  );

  it('accepts an exact token', () => {
    expect(isTokenSatisfied('c2s1', productTokens)).toBe(true);
    expect(isTokenSatisfied('25', productTokens)).toBe(true);
  });

  it('accepts a letter-led code as a prefix: a C2S1 mortar is a C2', () => {
    expect(isTokenSatisfied('c2', productTokens)).toBe(true);
  });

  it('rejects a digit-led token that only appears as a substring', () => {
    const tokens = new Set(tokenize('Peinture mate 12.5 L'));
    expect(isTokenSatisfied('2.5', tokens)).toBe(false);
  });

  it('rejects a dimension the product does not carry', () => {
    expect(isTokenSatisfied('30x30', productTokens)).toBe(false);
  });

  it('never prefix-matches an ordinary word', () => {
    // Sans cette restriction, « materiau » satisferait « mate ».
    const tokens = new Set(tokenize('Peinture materiau composite'));
    expect(isTokenSatisfied('mate', tokens)).toBe(false);
  });
});

describe('buildIdf', () => {
  const corpus = [
    'Peinture acrylique mate',
    'Peinture acrylique satinée',
    'Peinture glycéro brillante',
    'Carrelage 30x30 cm',
  ];

  it('weighs a rare token above a ubiquitous one', () => {
    const idf = buildIdf(corpus);
    expect(idf.get('satinee')!).toBeGreaterThan(idf.get('peinture')!);
    expect(idf.get('acrylique')!).toBeGreaterThan(idf.get('peinture')!);
  });

  it('treats an unseen token as maximally specific', () => {
    const idf = buildIdf(corpus);
    expect(idfOf(idf, 'inconnu', corpus.length)).toBeGreaterThan(
      idfOf(idf, 'peinture', corpus.length),
    );
  });
});
