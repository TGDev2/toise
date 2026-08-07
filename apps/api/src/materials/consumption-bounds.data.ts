/**
 * Encadrements de consommation par m² d'ouvrage — le pendant lisible par
 * machine de `docs/SOURCES_CATALOGUE.md`.
 *
 * Pourquoi ce fichier existe. E1-7 a confronté les 21 rendements servis en V1
 * à des fiches techniques fabricant : **douze étaient faux**, jusqu'à un
 * facteur 4 (`Enduit à joint prêt 7kg` : 2,5 → 1 ; `Plaque BA13` : 1 → 0,48 ;
 * `Bande à joint papier` : 1 → 0,36). Aucun des 1 619 tests du dépôt n'a rien
 * vu, et aucun instantané ne pouvait rien voir : un rendement faux produit une
 * table parfaitement plausible, seulement fausse. Il fallait donc écrire
 * quelque part ce qu'une consommation *peut* valoir, indépendamment de ce que
 * le catalogue prétend.
 *
 * Règle de dérivation, non négociable : **une borne vient de l'étalement des
 * chiffres publiés par les fabricants sur l'hypothèse d'ouvrage écrite dans
 * `docs/SOURCES_CATALOGUE.md`, jamais de la valeur seedée ± une tolérance.**
 * Une borne calée sur le seed ne peut, par construction, jamais rien attraper —
 * elle transforme le garde-fou en tautologie. Le champ `basis` porte la phrase
 * de fiche dont sort l'écart : si personne ne peut la relire, la borne ne vaut
 * rien.
 *
 * Sémantique de `min_per_m2` / `max_per_m2` : quantité de matériau, dans son
 * unité de catalogue, consommée pour 1 m² d'ouvrage **et par couche** — la
 * réciproque de `yield_per_unit`, divisée par le nombre de couches quand le
 * matériau déclare `applies_coats`. Les fiches peinture donnent leur rendement
 * par couche (vérifié, cf. registre) : les deux grandeurs sont donc bien
 * homogènes.
 *
 * Périmètre : les 19 matériaux distincts portés par les 21 liaisons
 * **obligatoires** de `work-type-materials.data.ts` — ceux que le moteur
 * chiffre. Un matériau lié sans borne déclarée ici n'est pas ignoré par le
 * harnais : il en sort une violation. Lier un matériau sans sourcer sa
 * consommation est donc une action visible, pas un oubli silencieux.
 *
 * **E1-5 — ce que ces bornes ne couvrent pas, et où c'est couvert.** Depuis que
 * le format du carreau pilote la colle et le joint
 * (`materials_catalog.consumption_model`), la consommation d'un mortier-colle
 * ou d'un mortier de jointoiement n'est plus un nombre mais une courbe : de 4,5
 * à 8 kg/m² de colle, et d'un facteur 7 sur le joint entre un 20 × 20 à 8 mm et
 * un 60 × 60 à 2 mm. Un encadrement unique par matériau qui devrait contenir
 * toute la courbe ne prouverait plus rien.
 *
 * Les bornes ci-dessous encadrent donc la consommation **à la géométrie par
 * défaut de l'ouvrage** — celle que le harnais éprouve, et celle qu'obtient un
 * utilisateur qui répond « Recommandé pour ce format ». Le reste de la courbe
 * est éprouvé ailleurs, et de façon plus exigeante qu'un intervalle :
 * `estimations/tile-consumption.spec.ts` confronte le moteur, format par
 * format, aux **cellules exactes** des tables fabricant.
 */

export interface ConsumptionBound {
  material_category: string;
  material_name: string;
  /** Doit égaler `materials_catalog.unit` — le harnais le vérifie. */
  unit: string;
  min_per_m2: number;
  max_per_m2: number;
  /** La phrase de fiche technique dont l'écart est tiré. */
  basis: string;
}

/**
 * Rendement **définitionnel** : le produit est vendu et posé au m², bord à
 * bord. 1 m² d'ouvrage consomme 1 m² de produit, et rien d'autre n'est
 * défendable — les chutes de coupe et de raccord sont portées par les
 * `waste_factors`, pas par le rendement (cf. `docs/SOURCES_CATALOGUE.md`, note
 * sur la laine de verre : « le quantitatif Placo compte 1,05, chutes portées
 * ici par les facteurs de perte »). L'encadrement est donc un point, pas un
 * intervalle : toute dérive est un défaut.
 */
const laidPerSquareMetre = (
  material_category: string,
  material_name: string,
  basis: string,
): ConsumptionBound => ({
  material_category,
  material_name,
  unit: 'm2',
  min_per_m2: 1,
  max_per_m2: 1,
  basis,
});

export const consumptionBounds: ConsumptionBound[] = [
  // --- painting -----------------------------------------------------------
  {
    material_category: 'painting',
    material_name: 'Peinture acrylique mate',
    unit: 'L',
    // 10 à 14 m²/L/couche.
    min_per_m2: 0.071,
    max_per_m2: 0.1,
    basis:
      'Dulux Valentine Crème de Couleur Mat Velouté « ≈11 m²/L » ; Zolpan Cofavelours « 10 à 12 m²/L/couche selon nature et état du support »',
  },
  {
    material_category: 'painting',
    material_name: 'Sous-couche universelle',
    unit: 'L',
    // 8 à 13 m²/L : une impression couvre plus sur plâtre lisse que sur enduit.
    min_per_m2: 0.077,
    max_per_m2: 0.125,
    basis:
      'Ripolin Sous-Couche Universelle Mat « Rendement : 10 m²/L », étalé sur la variabilité de porosité du support',
  },
  {
    material_category: 'painting',
    material_name: 'Peinture plafond mate',
    unit: 'L',
    // 8 à 12 m²/L/couche.
    min_per_m2: 0.083,
    max_per_m2: 0.125,
    basis:
      'Ripolin Plafonds Mat « 10 m²/L (NF 30 073) » ; V33 Blanc Perfection® « Rendement (m²/L) 10 »',
  },

  // --- tiling -------------------------------------------------------------
  laidPerSquareMetre(
    'tiling',
    'Carrelage sol 45x45 cm',
    'Vendu et posé au m² : rendement définitionnel',
  ),
  {
    material_category: 'tiling',
    material_name: 'Mortier-colle flexible (C2)',
    unit: 'kg',
    // Géométrie par défaut de `floor_tiling` : 45 × 45 (2 025 cm²), donc la
    // cellule « 1 200 < S ≤ 2 200 » à 7 kg/m², double encollage imposé par le
    // NF DTU 52.2 au-delà de 1 200 cm². L'intervalle 5-8 laisse la place à
    // l'écart entre fabricants sur cette même cellule (Weber 5,5 au peigne U9
    // en double, Mapei 6, Cermix et PRB 7 à 8).
    min_per_m2: 5,
    max_per_m2: 8,
    basis:
      'Cermix (CERMIFLEX C2S1 ET, CERMIPLUS 2.0, CERMIPLUS RAPID, CERMICOL EXTRA C1 E — table identique), sol intérieur, 1 200 < S ≤ 2 200 cm² : « 7 (U9) » ; Weber webercol flex U9 double 5,5 ; Mapei KERAFLEX U9 double 6 ; PRB U9 double 6 à 7',
  },
  {
    material_category: 'tiling',
    material_name: 'Joint fin 1-6mm',
    unit: 'kg',
    // Formule de fiche appliquée aux deux géométries par défaut du registre —
    // sol 45 × 45 / 9 mm / joint 3 mm, mur 25 × 40 / 7 mm / joint 3 mm — sur
    // l'étalement des densités apparentes publiées pour les mortiers de
    // jointoiement cimentaires (1,5 à 1,9) : 0,180 à 0,259 kg/m².
    //
    // Ce que cet encadrement remplace : 0,10-0,20, calé sur une consommation
    // qui valait 0,25 kg/m² **quels que soient** le format et la largeur de
    // joint. Ce n'est pas la borne qui se desserre, c'est la grandeur mesurée
    // qui a cessé d'être fausse.
    min_per_m2: 0.18,
    max_per_m2: 0.26,
    basis:
      'Cermix CERMIJOINT COLOR (CG2WA) : « 0,17 × ép(mm) × largeur de joint(mm) × (L + l) / (L × l) », L et l en cm — soit ((L+l)/(L·l)) × e × j × d avec d = 1,7 ; table de la même fiche : 45×45 à 3 mm = 0,2 kg/m²',
  },
  laidPerSquareMetre(
    'tiling',
    'Faïence murale 25x40 cm',
    'Vendue et posée au m² : rendement définitionnel',
  ),
  {
    material_category: 'tiling',
    material_name: "Colle en pâte prête à l'emploi",
    unit: 'kg',
    // 3 à 5,5 kg/m² : simple encollage au peigne 6 mm à double encollage.
    min_per_m2: 3,
    max_per_m2: 5.5,
    basis:
      'Cermix CERMIFIX (D2ET), mur intérieur, carreau 500-1 200 cm², double encollage : 4,5 kg/m² (U6) ; 3 kg/m² en simple encollage',
  },

  // --- flooring -----------------------------------------------------------
  laidPerSquareMetre(
    'flooring',
    'Stratifié 8mm AC4',
    'Vendu et posé au m² : rendement définitionnel',
  ),
  laidPerSquareMetre(
    'flooring',
    'Sous-couche mousse 3mm',
    'Quick-Step : « les bandes doivent être parfaitement adjacentes » — pose bord à bord, sans recouvrement',
  ),
  {
    material_category: 'flooring',
    material_name: 'Film pare-vapeur PE',
    unit: 'm2',
    // Lé de 1 m, recouvrement 10 à 25 cm → 1/0,90 à 1/0,75.
    min_per_m2: 1.11,
    max_per_m2: 1.34,
    basis:
      'Wineo PE-Dampfbremse « > 20 cm Stoßüberlappung », Tarkett « chevauchement d’au moins 200 mm », sur un lé de 1,00 m',
  },

  // --- partition ----------------------------------------------------------
  {
    material_category: 'partition',
    material_name: 'Plaque BA13 standard 2.5x1.2m',
    unit: 'm2',
    // Cloison simple peau, plaques sur les deux faces : 2 m²/m² plus les
    // chutes de calepinage retenues par la fiche quantitative.
    min_per_m2: 2,
    max_per_m2: 2.2,
    basis:
      'Placo® Fiche Solution Placostil® 72/48 BA13, par m² d’ouvrage : « Placoplatre® BA 13 — M2 — 2,10 »',
  },
  {
    material_category: 'partition',
    material_name: 'Rail R48 3m',
    unit: 'm',
    // 2 rails (haut et bas) par mètre linéaire, sur une hauteur de 2,5 à 3 m.
    min_per_m2: 0.7,
    max_per_m2: 1.1,
    basis:
      'Placo® Fiche Solution 72/48 : « Rail Stil® R 48 — M — 0,90 » par m² de cloison',
  },
  {
    material_category: 'partition',
    material_name: 'Montant M48 2.7m',
    unit: 'm',
    // Entraxe 0,40 à 0,60 m → 1,7 à 2,5 m de montant par m² de cloison.
    min_per_m2: 1.6,
    max_per_m2: 2.6,
    basis:
      'Placo® Fiche Solution 72/48, montants simples entraxe 0,60 : « Montant Stil® ML 48-50 — M — 2,10 » par m²',
  },
  {
    material_category: 'partition',
    material_name: 'Vis placo 25mm (x500)',
    unit: 'unit',
    // 18 à 28 vis/m² selon l'entraxe, en boîtes de 500.
    min_per_m2: 0.036,
    max_per_m2: 0.056,
    basis:
      'Placo® Fiche Solution 72/48 : « Vis TTPC 25 — UN — 22,00 » par m² (deux faces), en boîtes de 500',
  },
  {
    material_category: 'partition',
    material_name: 'Bande à joint papier 23m',
    unit: 'm',
    min_per_m2: 2.2,
    max_per_m2: 3.4,
    basis:
      'Placo® Fiche Solution 72/48 : « Bande PP grand Rouleau — M — 2,80 » par m², joints, cueillies et angles inclus',
  },
  {
    material_category: 'partition',
    material_name: 'Enduit à joint prêt 7kg',
    unit: 'kg',
    // 0,40 à 0,60 kg par m² de parement, × 2,1 m² de parement par m² de cloison.
    min_per_m2: 0.8,
    max_per_m2: 1.3,
    basis:
      'Placo® Placomix® « Consommation minimum 470 g/m² » de parement ; Siniat PRÉGY S PE 0,40-0,45 kg/m² — × 2,1 m² de parement par m² de cloison',
  },

  // --- wall_covering ------------------------------------------------------
  laidPerSquareMetre(
    'wall_covering',
    'Papier peint intissé uni',
    'Vendu et posé au m² : rendement définitionnel, les chutes de raccord relevant des facteurs de perte',
  ),
  {
    material_category: 'wall_covering',
    material_name: 'Colle papier peint intissé',
    unit: 'kg',
    // Colle en pâte prête à l'emploi : 6 à 10 m²/kg selon la porosité du fond.
    min_per_m2: 0.1,
    max_per_m2: 0.167,
    basis:
      'Quelyd Perfect (pâte prête à l’emploi, guide Bostik 2024) : « Envers intissés — 11 rouleaux — 55 m² » par seau 7 kg ≈ 7,9 m²/kg',
  },
];

/** Encadrements indexés comme le harnais identifie un matériau. */
export const consumptionBoundByMaterialKey = new Map<string, ConsumptionBound>(
  consumptionBounds.map((bound) => [
    `${bound.material_category}:${bound.material_name}`,
    bound,
  ]),
);
