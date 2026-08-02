export const CALCULATOR_SLUGS = ['peinture', 'carrelage', 'sol'] as const;

export type CalculatorSlug = (typeof CALCULATOR_SLUGS)[number];

/* -------------------------------------------------------------------------- */
/* Différenciateurs (GTM-9)                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Ces pages ne se disputent pas « calculateur peinture » : le terme appartient
 * aux calculettes d'enseigne, gratuites et indexées depuis des années, avec un
 * stock derrière le bouton. Sur le mètre carré théorique, nous n'avons rien de
 * plus à offrir — et les trois atouts réels du produit (photo → dimensions,
 * prix, liste d'achats) sont derrière le compte, donc absents d'ici.
 *
 * Ce qui reste, et qu'une calculette d'enseigne ne fait pas, tient en deux
 * idées : la **surface réellement à traiter** et la **quantité réellement à
 * acheter**. Chaque clé ci-dessous nomme un mécanisme qui s'exécute sur le
 * chemin **public** — `proof` le désigne. Une promesse sans clé n'a pas sa
 * place sur ces pages : c'est exactement ainsi que le lead magnet avait fini
 * par ne vendre que la brique commune.
 */
export type CalculatorDifferentiatorKey =
  | 'net_surface'
  | 'non_rectangular'
  | 'skill_waste'
  | 'packaging';

export interface CalculatorDifferentiator {
  key: CalculatorDifferentiatorKey;
  title: string;
  description: string;
  /** Mécanisme qui l'exécute sur le chemin public, pour la revue et le test. */
  proof: string;
}

export const CALCULATOR_DIFFERENTIATORS: Record<
  CalculatorDifferentiatorKey,
  CalculatorDifferentiator
> = {
  net_surface: {
    key: 'net_surface',
    title: 'La surface nette, pas la surface brute',
    description:
      'Portes, fenêtres, crédence, demi-mur, plinthes : tout ce que vous ne traitez pas est retiré du calcul. Une calculette qui multiplie longueur par hauteur vous fait acheter ces mètres carrés-là.',
    proof:
      'EstimationEngine.computeSurface — openingsAreaCm2 + excludedAreaCm2, filtrés par surface_target ; exclusions transmises par le chemin public depuis GTM-9.',
  },
  non_rectangular: {
    key: 'non_rectangular',
    title: 'Les pièces qui ne sont pas des rectangles',
    description:
      'Pièce en L, en T, en U, sous-pente ou décroché : décomposez-la en rectangles. Le calcul suit la vraie géométrie au lieu de vous demander d’arrondir au rectangle le plus proche.',
    proof:
      'RectSegmentDto sur PublicEstimateRequestDto → resolveSegments / unionAreaCm2 / unionPerimeterCm.',
  },
  skill_waste: {
    key: 'skill_waste',
    title: 'La marge de perte de votre niveau, pas un forfait',
    description:
      'Débutant, intermédiaire ou expert, et pose droite ou diagonale : la marge va de 5 à 20 % selon le cas. Un forfait unique de 10 % fait acheter trop à l’un et pas assez à l’autre.',
    proof:
      'resolveWasteFactor sur les waste_factors seedés par (pose_type, skill_level) — SeedMaterialsCatalog.ts.',
  },
  packaging: {
    key: 'packaging',
    title: 'Des pots et des paquets, pas des litres',
    description:
      'Le résultat est converti dans les conditionnements réellement vendus, en retenant le format qui laisse le moins de reste sur les bras. C’est ce que vous mettez dans le caddie.',
    proof:
      'EstimationEngine.selectBestPackaging — retient le format du catalogue qui minimise le surplus (un seul format, jamais une combinaison).',
  },
};

export type DraftWorkType = 'painting' | 'tiling' | 'flooring';

export interface CalculatorParamOption {
  value: string;
  label: string;
}

export interface CalculatorParam {
  key: 'number_of_coats' | 'tile_format' | 'laying_pattern';
  label: string;
  options: CalculatorParamOption[];
  defaultValue: string;
}

export interface CalculatorVariant {
  code: string;
  label: string;
  draftWorkType: DraftWorkType;
  params?: CalculatorParam[];
}

export interface CalculatorConfig {
  slug: CalculatorSlug;
  title: string;
  metaDescription: string;
  h1: string;
  intro: string;
  projectName: string;
  variants: CalculatorVariant[];
  /**
   * Ce que cette page apporte qu'une calculette d'enseigne n'apporte pas.
   * Obligatoire et pris dans l'ensemble fermé ci-dessus — cf.
   * `calculators-positioning.spec.ts`.
   */
  differentiators: CalculatorDifferentiatorKey[];
  faq: { question: string; answer: string }[];
}

const CALCULATORS: Record<CalculatorSlug, CalculatorConfig> = {
  peinture: {
    slug: 'peinture',
    title: 'Combien de peinture acheter : surface nette et pièce en L',
    metaDescription:
      'Le m² de peinture, tout le monde sait le calculer. Ici on calcule ce que vous devez acheter : portes, fenêtres, crédence et demi-mur déduits, pièces en L, et la marge de perte de votre niveau. Sans inscription.',
    h1: 'Combien de peinture acheter, vraiment',
    intro:
      'Déduisez ce que vous ne peignez pas — portes, fenêtres, crédence, demi-mur — décomposez les pièces en L, et laissez la marge de perte s’ajuster à votre niveau. Vous obtenez des pots à acheter, pas un mètre carré théorique. Gratuit et sans inscription.',
    projectName: 'Mon projet peinture',
    variants: [
      {
        code: 'wall_painting',
        label: 'Murs',
        draftWorkType: 'painting',
        params: [
          {
            key: 'number_of_coats',
            label: 'Nombre de couches',
            options: [
              { value: '1', label: '1 couche' },
              { value: '2', label: '2 couches' },
              { value: '3', label: '3 couches' },
            ],
            defaultValue: '2',
          },
        ],
      },
      {
        code: 'ceiling_painting',
        label: 'Plafond',
        draftWorkType: 'painting',
        params: [
          {
            key: 'number_of_coats',
            label: 'Nombre de couches',
            options: [
              { value: '1', label: '1 couche' },
              { value: '2', label: '2 couches' },
              { value: '3', label: '3 couches' },
            ],
            defaultValue: '2',
          },
        ],
      },
    ],
    differentiators: [
      'net_surface',
      'non_rectangular',
      'skill_waste',
      'packaging',
    ],
    faq: [
      {
        question: 'Comment calculer la quantité de peinture d’une pièce en L ?',
        answer:
          'Décomposez la pièce en rectangles : le calcul additionne leurs aires et suit le périmètre réel de l’ensemble, sans compter deux fois les murs mitoyens. Arrondir une pièce en L au rectangle qui l’englobe fait surestimer les murs, souvent de plusieurs mètres carrés.',
      },
      {
        question: 'Que faut-il déduire de la surface à peindre ?',
        answer:
          'Les portes et fenêtres, mais aussi tout ce que vous ne peignez pas : une crédence, un demi-mur lambrissé, la hauteur des plinthes. Ajoutez-les comme surfaces à exclure et leur aire est retirée du calcul des murs — le total affiché est celui qui est chiffré.',
      },
      {
        question: 'Quelle marge de perte prévoir pour de la peinture ?',
        answer:
          'Elle dépend de votre main : 15 % pour un débutant, 10 % pour un niveau intermédiaire, 5 % pour un peintre aguerri. Choisissez votre niveau et la marge s’ajuste, au lieu d’appliquer le forfait unique de 10 % que retiennent la plupart des calculettes.',
      },
      {
        question: 'Combien de couches de peinture prévoir ?',
        answer:
          'Deux couches sont la norme pour un résultat couvrant et durable. Une seule couche peut suffire pour un rafraîchissement dans la même teinte ; trois couches pour couvrir une couleur foncée ou un support poreux.',
      },
      {
        question: 'Le calculateur est-il vraiment gratuit ?',
        answer:
          'Oui, le calcul est gratuit et sans inscription. Il donne des quantités, pas des tarifs. Créez un compte gratuit uniquement si vous souhaitez sauvegarder votre projet et générer votre liste de courses complète.',
      },
    ],
  },
  carrelage: {
    slug: 'carrelage',
    title: 'Combien de carrelage acheter : chutes selon la pose et le niveau',
    metaDescription:
      'Le m² de carrelage, tout le monde sait le calculer. Ici on calcule les chutes : pose droite ou diagonale, débutant ou carreleur aguerri, de 5 à 20 % de marge. Pièces en L et surfaces à exclure comprises. Sans inscription.',
    h1: 'Combien de carrelage acheter, chutes comprises',
    intro:
      'La pose diagonale ne coupe pas comme la pose droite, et un premier chantier ne coupe pas comme le dixième. Choisissez votre pose et votre niveau : la marge de découpe suit, sur la surface réellement à carreler — décrochés et zones exclues déduits. Gratuit et sans inscription.',
    projectName: 'Mon projet carrelage',
    variants: [
      {
        code: 'floor_tiling',
        label: 'Sol',
        draftWorkType: 'tiling',
        params: [
          {
            key: 'tile_format',
            label: 'Format du carreau',
            options: [
              { value: '20x20', label: '20 × 20 cm' },
              { value: '30x30', label: '30 × 30 cm' },
              { value: '45x45', label: '45 × 45 cm' },
              { value: '60x60', label: '60 × 60 cm' },
              { value: '30x60', label: '30 × 60 cm' },
            ],
            defaultValue: '30x30',
          },
          {
            key: 'laying_pattern',
            label: 'Type de pose',
            options: [
              { value: 'straight', label: 'Pose droite' },
              { value: 'diagonal', label: 'Pose diagonale' },
            ],
            defaultValue: 'straight',
          },
        ],
      },
      {
        code: 'wall_tiling',
        label: 'Mur',
        draftWorkType: 'tiling',
      },
    ],
    differentiators: [
      'skill_waste',
      'net_surface',
      'non_rectangular',
      'packaging',
    ],
    faq: [
      {
        question: 'Quelle marge de chute prévoir pour du carrelage ?',
        answer:
          'Elle dépend d’abord de la pose, ensuite de votre main. En pose droite : 15 % pour un débutant, 10 % en intermédiaire, 5 % pour un carreleur aguerri. En pose diagonale : 20 %, 15 % et 10 %. Ces six valeurs sont appliquées automatiquement selon ce que vous choisissez.',
      },
      {
        question: 'La pose diagonale demande-t-elle plus de carrelage ?',
        answer:
          'Oui, environ cinq points de marge en plus : chaque rangée est coupée en biais en bord de pièce, et ces chutes-là ne se replacent nulle part. Une calculette qui ne demande pas le type de pose vous donne le même chiffre dans les deux cas.',
      },
      {
        question: 'Comment carreler une pièce en L ou avec un décroché ?',
        answer:
          'Décomposez-la en rectangles : leurs aires sont additionnées sans recouvrement. Vous pouvez aussi retirer ce qui n’est pas carrelé — un socle de douche, une trémie, un seuil — en l’ajoutant comme surface à exclure.',
      },
      {
        question: 'Le calculateur est-il vraiment gratuit ?',
        answer:
          'Oui, le calcul est gratuit et sans inscription. Il donne des quantités, pas des tarifs. Créez un compte gratuit uniquement si vous souhaitez sauvegarder votre projet et générer votre liste de courses complète.',
      },
    ],
  },
  sol: {
    slug: 'sol',
    title: 'Combien de parquet acheter : pièce en L et chutes de coupe',
    metaDescription:
      'Le m² de parquet, tout le monde sait le calculer. Ici on calcule les paquets à acheter : pièces en L ou avec décroché, zones non posées déduites, et une marge de coupe de 5 à 10 % selon votre niveau. Sans inscription.',
    h1: 'Combien de parquet acheter, découpes comprises',
    intro:
      'Une pièce en L, un décroché de cheminée, un seuil non posé : décrivez le sol tel qu’il est plutôt que de l’arrondir au rectangle. La marge de coupe s’ajuste à votre niveau, et le total est converti en paquets à acheter. Gratuit et sans inscription.',
    projectName: 'Mon projet sol',
    variants: [
      {
        code: 'parquet_flooring',
        label: 'Parquet / stratifié',
        draftWorkType: 'flooring',
      },
    ],
    differentiators: [
      'non_rectangular',
      'net_surface',
      'skill_waste',
      'packaging',
    ],
    faq: [
      {
        question: 'Comment calculer le parquet d’une pièce en L ?',
        answer:
          'Décomposez-la en rectangles : leurs aires sont additionnées sans recouvrement. Arrondir au rectangle englobant peut ajouter plusieurs mètres carrés, soit un paquet entier acheté pour rien.',
      },
      {
        question: 'Quelle marge de coupe prévoir pour un parquet ?',
        answer:
          '10 % pour une première pose, 7 % avec un peu de pratique, 5 % pour un poseur aguerri. La marge s’applique à la surface réellement posée, une fois retirées les zones que vous excluez.',
      },
      {
        question: 'Comment retirer une zone non posée du calcul ?',
        answer:
          'Ajoutez-la comme surface à exclure, avec son aire en m² : socle de cheminée, trémie d’escalier, seuil laissé nu. Elle est retirée du total, et le chiffre affiché est bien celui qui est chiffré.',
      },
      {
        question: 'Le calcul fonctionne-t-il pour le stratifié ?',
        answer:
          'Oui. Parquet massif, contrecollé ou stratifié : le principe de calcul de surface et de marge de coupe est le même.',
      },
      {
        question: 'Le calculateur est-il vraiment gratuit ?',
        answer:
          'Oui, le calcul est gratuit et sans inscription. Il donne des quantités, pas des tarifs. Créez un compte gratuit uniquement si vous souhaitez sauvegarder votre projet et générer votre liste de courses complète.',
      },
    ],
  },
};

export function getCalculatorConfig(slug: string): CalculatorConfig | null {
  return (CALCULATORS as Record<string, CalculatorConfig>)[slug] ?? null;
}
