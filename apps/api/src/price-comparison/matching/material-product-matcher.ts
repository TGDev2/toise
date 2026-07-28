/**
 * Rapprochement catalogue Chiffréo → produits d'un flux marchand.
 *
 * Le catalogue n'offre que trois signaux : un nom français en texte libre, une
 * catégorie parmi cinq, une unité parmi cinq. Pas de référence, pas d'EAN, pas
 * de mot-clé. La stratégie tient donc en quatre verrous successifs, du moins
 * cher au plus cher, et se refuse à produire un match douteux : en dessous du
 * seuil, aucune ligne n'est écrite et l'adaptateur répondra `not_found`.
 *
 * Le matcher est un accumulateur : on lui pousse les produits un par un au fil
 * du flux (`consider`), il ne retient que le meilleur candidat par matériau.
 * Le flux n'est jamais matérialisé en mémoire.
 */
import {
  buildIdf,
  idfOf,
  isSpecToken,
  isTokenSatisfied,
  normalizeText,
  tokenize,
} from './text-normalize';
import {
  materialUnitDimension,
  parsePackSize,
  type PackDimension,
  type PackSize,
} from './pack-size';

export type FeedAvailability = 'in_stock' | 'limited' | 'out_of_stock';

export interface FeedProduct {
  external_id: string;
  title: string;
  brand: string | null;
  category_path: string;
  price: number;
  currency: string;
  product_url: string;
  availability: FeedAvailability;
}

export interface MatchTarget {
  material_id: string;
  name: string;
  category: string;
  unit: string;
}

export interface MaterialProductMatch {
  material_id: string;
  product: FeedProduct;
  pack: PackSize;
  score: number;
}

/**
 * Premier verrou, appliqué avant tout scoring : il ramène un flux de plusieurs
 * centaines de milliers de références aux seuls rayons que le catalogue couvre.
 * Testé sur « chemin de catégorie + titre » normalisés, donc `sous.?couche`
 * attrape aussi bien « sous-couche » que « sous couche ».
 */
export const CATEGORY_FEED_PATTERNS: Record<string, RegExp> = {
  painting:
    /peinture|enduit|sous.?couche|primaire|impression|vernis|lasure|fixateur/,
  tiling:
    /carrelage|faience|carreau|mortier.?colle|joint|plinthe|croisillon|ragreage/,
  flooring:
    /parquet|stratifie|vinyle|lino|moquette|sol.?souple|lame.?pvc|barre.?de.?seuil/,
  partition:
    /cloison|placo|plaque.?de.?platre|ba13|ba18|rail|montant|ossature|isolant|laine.?de.?(?:verre|roche)|bande.?a.?joint/,
  wall_covering:
    /papier.?peint|lambris|toile.?de.?verre|revetement.?mural|frise|moulure|parement/,
};

/**
 * Couverture IDF minimale pour accepter un match. Calibré pour que
 * « Peinture acrylique satinée » accepte « Peinture acrylique satinée blanche
 * 2,5 L Dulux » (tous les tokens de la requête présents) et refuse
 * « Peinture glycéro brillante » (seul « peinture », le token le moins
 * discriminant, est commun).
 */
export const MIN_MATCH_SCORE = 0.55;

interface PreparedTarget {
  target: MatchTarget;
  dimension: PackDimension;
  tokens: string[];
  specTokens: string[];
  /**
   * Tokens qui appartiennent à un *autre* matériau du même rayon et pas à
   * celui-ci. Leur présence dans un titre produit signe un produit qui parle
   * du voisin — voir le verrou correspondant dans `considerTarget`.
   */
  rivalTokens: Set<string>;
  weights: Map<string, number>;
  totalWeight: number;
}

export interface MatcherStats {
  targets: number;
  considered: number;
  matched: number;
}

export class MaterialProductMatcher {
  private readonly byCategory = new Map<string, PreparedTarget[]>();
  private readonly best = new Map<string, MaterialProductMatch>();
  private readonly minScore: number;
  private preparedCount = 0;
  private consideredCount = 0;

  constructor(
    targets: readonly MatchTarget[],
    minScore: number = MIN_MATCH_SCORE,
  ) {
    this.minScore = minScore;

    // L'IDF est calculé sur le catalogue, pas sur le flux : une seule passe,
    // déterministe, et c'est bien la spécificité *au sein du catalogue* qui
    // doit départager deux produits du même rayon.
    const idf = buildIdf(targets.map((target) => target.name));

    for (const target of targets) {
      const dimension = materialUnitDimension(target.unit);
      if (!dimension) {
        // Unité inconnue : impossible de vérifier la cohérence du
        // conditionnement, donc impossible de tarifer sans risque.
        continue;
      }

      const tokens = [...new Set(tokenize(target.name))];
      if (tokens.length === 0) {
        continue;
      }

      const weights = new Map(
        tokens.map((token) => [token, idfOf(idf, token, targets.length)]),
      );
      const totalWeight = [...weights.values()].reduce(
        (sum, weight) => sum + weight,
        0,
      );
      if (totalWeight <= 0) {
        continue;
      }

      const prepared: PreparedTarget = {
        target,
        dimension,
        tokens,
        specTokens: tokens.filter(isSpecToken),
        rivalTokens: new Set(),
        weights,
        totalWeight,
      };

      const bucket = this.byCategory.get(target.category);
      if (bucket) {
        bucket.push(prepared);
      } else {
        this.byCategory.set(target.category, [prepared]);
      }
      this.preparedCount++;
    }

    this.indexRivalTokens();
  }

  /**
   * Pour chaque matériau, l'ensemble des tokens que portent ses voisins de
   * rayon et que lui-même n'a pas.
   */
  private indexRivalTokens(): void {
    for (const targets of this.byCategory.values()) {
      const categoryTokens = new Set<string>();
      for (const prepared of targets) {
        for (const token of prepared.tokens) {
          categoryTokens.add(token);
        }
      }

      for (const prepared of targets) {
        const own = new Set(prepared.tokens);
        for (const token of categoryTokens) {
          if (!own.has(token)) {
            prepared.rivalTokens.add(token);
          }
        }
      }
    }
  }

  /** Confronte un produit du flux à tous les matériaux de ses rayons. */
  consider(product: FeedProduct): void {
    this.consideredCount++;

    if (!(product.price > 0) || !product.external_id || !product.title) {
      return;
    }

    const haystack = normalizeText(`${product.category_path} ${product.title}`);
    const productTokens = new Set(
      tokenize(`${product.title} ${product.brand ?? ''}`),
    );

    const candidates: MaterialProductMatch[] = [];
    for (const [category, targets] of this.byCategory) {
      const pattern = CATEGORY_FEED_PATTERNS[category];
      if (!pattern?.test(haystack)) {
        continue;
      }

      for (const prepared of targets) {
        const candidate = this.evaluate(prepared, product, productTokens);
        if (candidate) {
          candidates.push(candidate);
        }
      }
    }

    if (candidates.length === 0) {
      return;
    }

    // Cinquième verrou : un produit n'est revendiqué que par le matériau
    // auquel il correspond le mieux. « Peinture acrylique mate blanche »
    // satisfait « Peinture acrylique mate » entièrement et « Peinture
    // acrylique extra-mate » aux deux tiers ; sans cet arbitrage, le second
    // recevrait le prix du premier.
    const bestScore = Math.max(...candidates.map((c) => c.score));
    for (const candidate of candidates) {
      if (candidate.score < bestScore - EPSILON) {
        continue;
      }
      const incumbent = this.best.get(candidate.material_id);
      if (!incumbent || isBetterMatch(candidate, incumbent)) {
        this.best.set(candidate.material_id, candidate);
      }
    }
  }

  private evaluate(
    prepared: PreparedTarget,
    product: FeedProduct,
    productTokens: ReadonlySet<string>,
  ): MaterialProductMatch | null {
    // Deuxième verrou : tout token technique du matériau doit se retrouver
    // dans le produit. C'est lui qui empêche un 30x30 de matcher un 60x60 ou
    // un mortier C2 de matcher un C1.
    for (const specToken of prepared.specTokens) {
      if (!isTokenSatisfied(specToken, productTokens)) {
        return null;
      }
    }

    // Troisième verrou : le produit ne doit pas porter le mot qui caractérise
    // un voisin de rayon. « Peinture glycéro satinée » couvre l'essentiel du
    // nom de « Peinture glycéro mate » — ce qui le disqualifie n'est pas ce
    // qui lui manque, c'est le « satinée » qu'il porte et qui appartient à un
    // autre matériau du catalogue.
    for (const token of productTokens) {
      if (prepared.rivalTokens.has(token)) {
        return null;
      }
    }

    // Quatrième verrou : couverture pondérée IDF des tokens du matériau.
    let matchedWeight = 0;
    for (const token of prepared.tokens) {
      if (isTokenSatisfied(token, productTokens)) {
        matchedWeight += prepared.weights.get(token) ?? 0;
      }
    }
    const score = matchedWeight / prepared.totalWeight;
    if (score < this.minScore) {
      return null;
    }

    // Le produit doit exposer un conditionnement dans la grandeur du
    // matériau, sinon `unit_price * units_needed` n'a pas de sens.
    const pack = parsePackSize(product.title, prepared.dimension);
    if (!pack) {
      return null;
    }

    return {
      material_id: prepared.target.material_id,
      product,
      pack,
      score,
    };
  }

  results(): MaterialProductMatch[] {
    return [...this.best.values()];
  }

  stats(): MatcherStats {
    return {
      targets: this.preparedCount,
      considered: this.consideredCount,
      matched: this.best.size,
    };
  }
}

const EPSILON = 1e-9;

/**
 * Départage deux candidats : meilleure couverture, puis prix à l'unité de
 * grandeur le plus bas, puis identifiant produit. Le dernier critère n'a
 * d'autre rôle que de rendre le résultat indépendant de l'ordre des lignes du
 * flux, donc reproductible d'une synchronisation à l'autre.
 */
function isBetterMatch(
  candidate: MaterialProductMatch,
  incumbent: MaterialProductMatch,
): boolean {
  if (candidate.score > incumbent.score + EPSILON) {
    return true;
  }
  if (incumbent.score > candidate.score + EPSILON) {
    return false;
  }

  const candidateUnitPrice = candidate.product.price / candidate.pack.qty;
  const incumbentUnitPrice = incumbent.product.price / incumbent.pack.qty;
  if (candidateUnitPrice < incumbentUnitPrice - EPSILON) {
    return true;
  }
  if (incumbentUnitPrice < candidateUnitPrice - EPSILON) {
    return false;
  }

  return candidate.product.external_id < incumbent.product.external_id;
}
