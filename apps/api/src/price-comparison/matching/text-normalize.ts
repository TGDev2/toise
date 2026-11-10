/**
 * Normalisation de texte français pour le matching catalogue → produits marchands.
 *
 * Le catalogue Toisé ne porte ni référence, ni EAN, ni mot-clé : le seul
 * signal textuel est `materials_catalog.name`, du français accentué mêlé de
 * notation technique (« Mortier-colle flexible (C2) », « Carrelage 30x30 cm »,
 * « Colle en pâte prête à l'emploi »). Ces helpers sont purs et sans I/O.
 */

/**
 * Mots vides français. Volontairement court : on ne retire que ce qui n'a
 * aucun pouvoir discriminant entre deux matériaux du même rayon.
 */
const FRENCH_STOPWORDS = new Set([
  'de',
  'du',
  'des',
  'le',
  'la',
  'les',
  'un',
  'une',
  'en',
  'et',
  'au',
  'aux',
  'pour',
  'avec',
  'sur',
  'sans',
  'par',
  'ou',
  'sa',
  'se',
  'ce',
  'ces',
]);

/**
 * Replie les accents, unifie les apostrophes typographiques, les décimales à
 * la française et les notations de dimension, puis réduit tout le reste à des
 * espaces.
 *
 * « Boîte 1,08 m² - 30 x 30 » devient « boite 1.08 m2 30x30 ».
 */
export function normalizeText(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[‘’ʼ]/g, "'")
      .replace(/²/g, '2')
      .replace(/³/g, '3')
      .replace(/(\d)\s*,(\d)/g, '$1.$2')
      .replace(/(\d)\s*[x×]\s*(\d)/g, '$1x$2')
      // Détache l'unité collée au nombre : le catalogue écrit « Lambris 2.6m »
      // là où le flux marchand écrit « 2,6 m ». Sans cela les deux ne
      // produisent pas le même token technique et le verrou du matcher rejette
      // un match pourtant correct.
      .replace(/(\d)\s*(m2|mm|cm|kg|ml|metres?|litres?|[mlg])\b/g, '$1 $2')
      .replace(/[^a-z0-9.]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Découpe en tokens signifiants : normalisation, retrait des points
 * orphelins, des mots vides et des tokens d'un seul caractère.
 */
export function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(' ')
    .map((token) => token.replace(/^\.+|\.+$/g, ''))
    .filter((token) => token.length > 1 && !FRENCH_STOPWORDS.has(token));
}

/**
 * Un token « technique » porte un chiffre : dimension (`30x30`), volume
 * (`2.5`), classe normalisée (`c2`, `ba13`). Ce sont les tokens qui
 * distinguent deux produits par ailleurs identiques, d'où le verrou strict
 * appliqué par le matcher.
 */
export function isSpecToken(token: string): boolean {
  return /\d/.test(token);
}

/** Code normalisé de la construction : des lettres suivies d'un chiffre. */
const TECHNICAL_CODE = /^[a-z]+\d/;

/**
 * Un token de la requête est satisfait s'il apparaît tel quel dans le produit,
 * ou — pour les seuls codes normalisés — en préfixe d'un token produit : un
 * mortier `C2S1` est bien un `C2`, une plaque `BA13` est bien une `BA13`.
 *
 * Le préfixe est délibérément réservé aux codes. Autorisé sur un mot ordinaire
 * il ferait passer « materiau » pour « mate » ; autorisé sur un token numérique
 * il ferait passer « 12.5 » pour « 2.5 » et « 130x300 » pour « 30x30 ».
 */
export function isTokenSatisfied(
  token: string,
  productTokens: ReadonlySet<string>,
): boolean {
  if (productTokens.has(token)) {
    return true;
  }
  if (!TECHNICAL_CODE.test(token)) {
    return false;
  }
  for (const productToken of productTokens) {
    if (productToken.startsWith(token)) {
      return true;
    }
  }
  return false;
}

/**
 * IDF calculé sur le catalogue (208 lignes), pas sur le flux marchand : une
 * seule passe, déterministe, et c'est exactement le signal recherché —
 * « peinture » apparaît dans 54 noms et ne discrimine rien, « satinee »
 * apparaît trois fois et discrimine tout.
 */
export function buildIdf(corpus: readonly string[]): Map<string, number> {
  const documentFrequency = new Map<string, number>();
  for (const document of corpus) {
    for (const token of new Set(tokenize(document))) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  const total = corpus.length;
  const idf = new Map<string, number>();
  for (const [token, frequency] of documentFrequency) {
    idf.set(token, Math.log(1 + total / (1 + frequency)));
  }
  return idf;
}

/** Poids d'un token absent du corpus : traité comme maximalement spécifique. */
export function idfOf(
  idf: ReadonlyMap<string, number>,
  token: string,
  corpusSize: number,
): number {
  return idf.get(token) ?? Math.log(1 + corpusSize);
}
