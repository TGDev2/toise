export const CALCULATOR_SLUGS = ['peinture', 'carrelage', 'sol'] as const;

export type CalculatorSlug = (typeof CALCULATOR_SLUGS)[number];

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
  faq: { question: string; answer: string }[];
}

const CALCULATORS: Record<CalculatorSlug, CalculatorConfig> = {
  peinture: {
    slug: 'peinture',
    title: 'Calculateur peinture : quantité de peinture au m²',
    metaDescription:
      'Calculez gratuitement la quantité de peinture nécessaire pour vos murs ou votre plafond : dimensions de la pièce, ouvertures, nombre de couches. Sans inscription.',
    h1: 'Calculateur de peinture gratuit',
    intro:
      'Indiquez les dimensions de votre pièce et ses ouvertures : nous calculons la surface à peindre et la quantité de peinture nécessaire (pots et litres), couches comprises. Gratuit et sans inscription.',
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
    faq: [
      {
        question: 'Comment calculer la quantité de peinture nécessaire ?',
        answer:
          'On calcule la surface à peindre (périmètre de la pièce × hauteur, moins les portes et fenêtres pour les murs), puis on la divise par le rendement de la peinture (m² couverts par litre) et on multiplie par le nombre de couches. Notre calculateur ajoute aussi une marge de perte adaptée à votre niveau.',
      },
      {
        question: 'Combien de couches de peinture prévoir ?',
        answer:
          'Deux couches sont la norme pour un résultat couvrant et durable. Une seule couche peut suffire pour un rafraîchissement dans la même teinte ; trois couches pour couvrir une couleur foncée ou un support poreux.',
      },
      {
        question: 'Faut-il déduire les portes et les fenêtres ?',
        answer:
          'Oui. Le calculateur déduit automatiquement la surface des ouvertures que vous ajoutez, pour ne pas acheter de peinture en trop.',
      },
      {
        question: 'Le calculateur est-il vraiment gratuit ?',
        answer:
          'Oui, le calcul est gratuit et sans inscription. Créez un compte gratuit uniquement si vous souhaitez sauvegarder votre projet et générer votre liste de courses complète.',
      },
    ],
  },
  carrelage: {
    slug: 'carrelage',
    title: 'Calculateur carrelage : nombre de carreaux au m²',
    metaDescription:
      'Calculez gratuitement la quantité de carrelage nécessaire pour votre sol ou vos murs : dimensions, format des carreaux, type de pose. Sans inscription.',
    h1: 'Calculateur de carrelage gratuit',
    intro:
      'Indiquez les dimensions de votre pièce, le format de vos carreaux et le type de pose : nous calculons la surface à carreler et le nombre de paquets nécessaires, marge de découpe comprise. Gratuit et sans inscription.',
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
    faq: [
      {
        question: 'Comment calculer la quantité de carrelage nécessaire ?',
        answer:
          'On mesure la surface à carreler (longueur × largeur pour un sol), puis on ajoute une marge de découpe qui dépend du type de pose et de votre expérience. Le calculateur convertit ensuite cette surface en nombre de paquets à acheter.',
      },
      {
        question: 'Quelle marge prévoir pour les découpes ?',
        answer:
          'Comptez environ 10 % de marge pour une pose droite et davantage pour une pose en diagonale, qui génère plus de chutes. Le calculateur applique automatiquement la marge adaptée à la pose choisie et à votre niveau.',
      },
      {
        question: 'La pose diagonale demande-t-elle plus de carrelage ?',
        answer:
          'Oui. La pose en diagonale multiplie les découpes en bord de pièce, ce qui augmente les pertes. Notre calcul en tient compte pour éviter un retour au magasin en plein chantier.',
      },
      {
        question: 'Le calculateur est-il vraiment gratuit ?',
        answer:
          'Oui, le calcul est gratuit et sans inscription. Créez un compte gratuit uniquement si vous souhaitez sauvegarder votre projet et générer votre liste de courses complète.',
      },
    ],
  },
  sol: {
    slug: 'sol',
    title: 'Calculateur parquet et sol : surface et quantité au m²',
    metaDescription:
      'Calculez gratuitement la quantité de parquet ou de stratifié nécessaire pour votre pièce : dimensions, marge de découpe. Sans inscription.',
    h1: 'Calculateur de parquet et sol gratuit',
    intro:
      'Indiquez les dimensions de votre pièce : nous calculons la surface de sol et le nombre de paquets de parquet ou de stratifié nécessaires, marge de découpe comprise. Gratuit et sans inscription.',
    projectName: 'Mon projet sol',
    variants: [
      {
        code: 'parquet_flooring',
        label: 'Parquet / stratifié',
        draftWorkType: 'flooring',
      },
    ],
    faq: [
      {
        question: 'Comment calculer la surface de parquet nécessaire ?',
        answer:
          'On multiplie la longueur par la largeur de la pièce, puis on ajoute une marge de découpe pour les coupes en bord de mur. Le calculateur convertit ensuite cette surface en nombre de paquets à acheter.',
      },
      {
        question: 'Quelle marge de découpe prévoir pour un parquet ?',
        answer:
          'Comptez généralement 8 à 12 % de marge selon la complexité de la pièce et votre expérience de pose. Le calculateur applique une marge adaptée à votre niveau.',
      },
      {
        question: 'Le calcul fonctionne-t-il pour le stratifié ?',
        answer:
          'Oui. Parquet massif, contrecollé ou stratifié : le principe de calcul de surface et de marge de découpe est le même.',
      },
      {
        question: 'Le calculateur est-il vraiment gratuit ?',
        answer:
          'Oui, le calcul est gratuit et sans inscription. Créez un compte gratuit uniquement si vous souhaitez sauvegarder votre projet et générer votre liste de courses complète.',
      },
    ],
  },
};

export function getCalculatorConfig(slug: string): CalculatorConfig | null {
  return (CALCULATORS as Record<string, CalculatorConfig>)[slug] ?? null;
}
