/**
 * Géométrie des pièces composées de rectangles (ENG-1).
 *
 * Une pièce non rectangulaire (L, T, U, croix…) est décrite comme l'union de
 * plusieurs rectangles axis-aligned positionnés dans un plan vu de dessus :
 * `x_cm`/`y_cm` = coin minimal, `length_cm` = extension sur X, `width_cm` =
 * extension sur Y.
 *
 * Deux grandeurs suffisent au moteur d'estimation :
 *  - l'aire de l'union (sol / plafond) ;
 *  - le périmètre du contour de l'union (base du calcul des murs : périmètre ×
 *    hauteur). Les arêtes internes partagées entre deux rectangles ne sont pas
 *    des murs — une simple somme des périmètres serait fausse.
 *
 * Méthode : compression de coordonnées + remplissage de cellules. Exact pour
 * toute forme rectilinéaire, robuste aux chevauchements (union, pas de double
 * comptage), sans dépendance. La grille reste minuscule (≤ quelques cellules
 * pour une poignée de rectangles).
 */

export interface RectSegment {
  /** Coin minimal sur X (cm). */
  x_cm: number;
  /** Coin minimal sur Y (cm). */
  y_cm: number;
  /** Extension sur X (cm). */
  length_cm: number;
  /** Extension sur Y (cm). */
  width_cm: number;
}

interface CompressedGrid {
  /** Coordonnées X uniques triées (frontières des colonnes). */
  xs: number[];
  /** Coordonnées Y uniques triées (frontières des lignes). */
  ys: number[];
  /** grid[i][j] = true si la cellule [xs[i], xs[i+1]] × [ys[j], ys[j+1]] est couverte. */
  grid: boolean[][];
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

/**
 * Ne conserve que les segments à surface strictement positive : un rectangle
 * dégénéré (largeur ou longueur nulle/négative) ne contribue ni à l'aire ni au
 * périmètre.
 */
function validSegments(segments: RectSegment[]): RectSegment[] {
  return segments.filter((s) => s.length_cm > 0 && s.width_cm > 0);
}

function buildGrid(segments: RectSegment[]): CompressedGrid {
  const valid = validSegments(segments);
  if (valid.length === 0) {
    return { xs: [], ys: [], grid: [] };
  }

  const xs = uniqueSorted(valid.flatMap((s) => [s.x_cm, s.x_cm + s.length_cm]));
  const ys = uniqueSorted(valid.flatMap((s) => [s.y_cm, s.y_cm + s.width_cm]));

  const cols = xs.length - 1;
  const rows = ys.length - 1;
  const grid: boolean[][] = [];

  for (let i = 0; i < cols; i++) {
    grid[i] = [];
    // Le centre de la cellule tombe strictement à l'intérieur d'un segment qui
    // la couvre (les frontières de la grille sont alignées sur les arêtes des
    // segments), d'où l'usage d'inégalités strictes.
    const cx = (xs[i] + xs[i + 1]) / 2;
    for (let j = 0; j < rows; j++) {
      const cy = (ys[j] + ys[j + 1]) / 2;
      grid[i][j] = valid.some(
        (s) =>
          cx > s.x_cm &&
          cx < s.x_cm + s.length_cm &&
          cy > s.y_cm &&
          cy < s.y_cm + s.width_cm,
      );
    }
  }

  return { xs, ys, grid };
}

/** Aire de l'union des rectangles, en cm². */
export function unionAreaCm2(segments: RectSegment[]): number {
  const { xs, ys, grid } = buildGrid(segments);
  let area = 0;

  for (let i = 0; i < grid.length; i++) {
    const cellW = xs[i + 1] - xs[i];
    for (let j = 0; j < grid[i].length; j++) {
      if (grid[i][j]) {
        area += cellW * (ys[j + 1] - ys[j]);
      }
    }
  }

  return area;
}

/**
 * Périmètre du contour de l'union des rectangles, en cm.
 *
 * Chaque cellule pleine expose une arête vers l'extérieur dès qu'une de ses
 * quatre voisines est vide (ou hors grille). La longueur ajoutée est la vraie
 * dimension de l'arête concernée.
 */
export function unionPerimeterCm(segments: RectSegment[]): number {
  const { xs, ys, grid } = buildGrid(segments);
  const cols = grid.length;
  let perimeter = 0;

  for (let i = 0; i < cols; i++) {
    const rows = grid[i].length;
    const cellW = xs[i + 1] - xs[i];
    for (let j = 0; j < rows; j++) {
      if (!grid[i][j]) continue;
      const cellH = ys[j + 1] - ys[j];

      // Arêtes verticales (gauche / droite) : longueur = hauteur de la cellule.
      if (i === 0 || !grid[i - 1][j]) perimeter += cellH;
      if (i === cols - 1 || !grid[i + 1][j]) perimeter += cellH;
      // Arêtes horizontales (bas / haut) : longueur = largeur de la cellule.
      if (j === 0 || !grid[i][j - 1]) perimeter += cellW;
      if (j === rows - 1 || !grid[i][j + 1]) perimeter += cellW;
    }
  }

  return perimeter;
}
