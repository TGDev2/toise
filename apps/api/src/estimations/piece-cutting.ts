import { PackagingInput } from './estimation-engine';

/**
 * E1-8 — l'achat d'un matériau **découpé à longueur**, dont les chutes ne se
 * réutilisent pas.
 *
 * D'où vient ce module. Le moteur métrait l'ossature en mètres linéaires puis
 * divisait par la longueur de barre : `74,520 m ÷ 2,70 m → 28 barres`. C'est le
 * bon calcul pour un rail, posé en course continue au sol et au plafond — deux
 * bouts de barre s'aboutent et rien ne se perd. C'est le mauvais pour un
 * montant : chaque montant est coupé à la hauteur de la cloison, et ce qui
 * reste de la barre n'ira nulle part. Sous 2,30 m de plafond, une barre de
 * 2,70 m donne **un** montant et 0,40 m de chute ; il faut donc autant de
 * barres que d'emplacements — 30, pas 28.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI LA PERTE DE COUPE N'EST PAS APPLIQUÉE ICI
 * ---------------------------------------------------------------------------
 *
 * Parce qu'elle est **mesurée**. Un facteur de perte est une estimation de ce
 * qu'on va jeter ; sur un matériau découpé à longueur, ce qu'on va jeter est
 * exactement `barres × longueur de barre − pièces × longueur de pièce`, et ce
 * module le calcule. Ajouter par-dessus les 12/8/4 % de la plâtrerie compterait
 * deux fois la même chute — c'est mot pour mot le double comptage qu'E1-7 a
 * retiré aux mortiers-colle, dont la consommation suivait la surface *achetée*
 * du carrelage au lieu de sa surface *nette*.
 *
 * L'arbitrage n'est pas gratuit et il est écrit au registre : ce qui disparaît
 * avec le forfait, c'est la **casse** — la barre pliée, le montant recoupé trop
 * court. Aucune source consultée ne la chiffre. Le catalogue déclare donc 0 %
 * pour ces matériaux (`measuredOffcutWaste()`), une valeur qui se voit et se
 * discute, plutôt qu'un contournement dans le moteur.
 *
 * ---------------------------------------------------------------------------
 * CE QUE LE MODULE NE FAIT PAS
 * ---------------------------------------------------------------------------
 *
 * Il ne devine aucune longueur de pièce. Elle lui est donnée par l'ouvrage —
 * aujourd'hui la hauteur de la trame (`FrameQuantities.stud_piece_length_m`).
 * Un matériau déclaré non aboutable dont l'ouvrage ne dit pas la géométrie de
 * pièce fait **lever** le moteur, comme un `frame_stud` sans `frame_spec` :
 * c'est la seule réponse qui ne fabrique pas un chiffre plausible et faux.
 */

/** Ce qu'un ouvrage demande : N pièces d'une longueur donnée. */
export interface PieceDemand {
  /** Nombre de pièces à découper — emplacements de la trame, par exemple. */
  count: number;
  /** Longueur d'une pièce, dans l'unité du matériau (mètres). */
  length_m: number;
}

/** L'achat qui couvre cette demande. */
export interface PieceCut {
  /** Pièces réellement nécessaires. */
  pieces: number;
  /** Longueur d'une pièce, reportée pour que la ligne se relise seule. */
  piece_length_m: number;
  /** Pièces qu'une barre du format retenu peut donner. */
  pieces_per_bar: number;
  /** Barres à acheter : `ceil(pieces / pieces_per_bar)`. */
  bars: number;
  /** Format retenu. */
  label: string;
  /** Longueur d'une barre du format retenu. */
  bar_length_m: number;
}

/**
 * Aucun format offert n'est assez long pour une seule pièce.
 *
 * Erreur nue, et non `BadRequestException` : contrairement à une pose inconnue,
 * ce n'est pas la demande qui est mal formée mais le catalogue qui est
 * inutilisable — on demande de dresser une cloison de 3 m avec des barres de
 * 2,70 m. Le repli imaginable (abouter deux barres) est précisément ce que le
 * matériau déclare impossible.
 */
export class PieceTooLongError extends Error {
  constructor(
    readonly materialName: string,
    readonly pieceLengthM: number,
    readonly longestBarM: number,
  ) {
    super(
      `« ${materialName} » se découpe à longueur : une pièce de ` +
        `${pieceLengthM.toFixed(3)} m ne tient dans aucun format offert ` +
        `(le plus long fait ${longestBarM.toFixed(3)} m)`,
    );
    this.name = 'PieceTooLongError';
  }
}

/**
 * Tolérance sur le nombre de pièces par barre. Sans elle, `2,70 / 0,90 =
 * 2.9999999999999996` donnerait deux pièces au lieu de trois, et ferait acheter
 * la moitié de barres en trop. Même rôle que `STEP_EPSILON` et `SPAN_EPSILON`
 * dans le moteur, et sans effet réel : 1e-9 pièce vaut moins d'un micron.
 */
const FIT_EPSILON = 1e-9;

/**
 * Combien de barres, et de quel format.
 *
 * Le critère est **celui du moteur** (`selectBestPackaging`, E1-5) :
 *
 *     minimiser  S = q_min × (nombre de barres) + (longueur achetée)
 *
 * Reprendre le même critère n'est pas une élégance : deux critères sur le même
 * catalogue produiraient deux réponses différentes pour le même besoin, et rien
 * ne dirait laquelle est la bonne. Ici il départage un catalogue qui n'offrirait
 * qu'une longueur de barre par matériau — c'est le cas aujourd'hui — mais il
 * couvre le jour où deux longueurs coexisteraient, sans qu'on ait à y revenir.
 *
 * Un format trop court pour une seule pièce est écarté et non arrondi à zéro :
 * une barre de 2,40 m ne participe pas à un montant de 2,50 m, quel qu'en soit
 * le prix.
 */
export function computePieceCut(
  materialName: string,
  demand: PieceDemand,
  packagings: PackagingInput[],
): PieceCut {
  const pieceLength = Number(demand.length_m);
  if (!Number.isFinite(pieceLength) || pieceLength <= 0) {
    throw new Error(
      `« ${materialName} » se découpe à longueur, mais la longueur de pièce ` +
        `reçue est inexploitable (${demand.length_m})`,
    );
  }

  const formats = packagings
    .map((pkg) => ({
      label: pkg.label,
      bar_length_m: Number(pkg.quantity_per_unit),
    }))
    .filter((f) => Number.isFinite(f.bar_length_m) && f.bar_length_m > 0);

  if (formats.length === 0) {
    throw new Error(
      `« ${materialName} » se découpe à longueur, mais aucun conditionnement ` +
        `exploitable n'est déclaré`,
    );
  }

  const longest = Math.max(...formats.map((f) => f.bar_length_m));
  const usable = formats
    .map((f) => ({
      ...f,
      pieces_per_bar: Math.floor(f.bar_length_m / pieceLength + FIT_EPSILON),
    }))
    .filter((f) => f.pieces_per_bar >= 1);

  if (usable.length === 0) {
    throw new PieceTooLongError(materialName, pieceLength, longest);
  }

  const pieces = Math.max(0, Math.ceil(demand.count));
  const smallest = Math.min(...formats.map((f) => f.bar_length_m));

  const best = usable
    .map((f) => {
      const bars = Math.ceil(pieces / f.pieces_per_bar);
      return { ...f, bars, cost: smallest * bars + bars * f.bar_length_m };
    })
    // À coût égal, le format qui donne le plus de pièces par barre : moins de
    // barres à porter, et le choix reste déterministe.
    .sort((a, b) => a.cost - b.cost || b.pieces_per_bar - a.pieces_per_bar)[0];

  return {
    pieces,
    piece_length_m: pieceLength,
    pieces_per_bar: best.pieces_per_bar,
    bars: best.bars,
    label: best.label,
    bar_length_m: best.bar_length_m,
  };
}
