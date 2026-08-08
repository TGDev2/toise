/**
 * E2-1 — registre des temps de pose unitaires, source de vérité unique.
 *
 * Importé par la migration `…097-CreateLaborTimeRegistry` (seed) et par
 * `labor-sources-catalogue.spec.ts` (cohérence avec le tableau de
 * `docs/SOURCES_CATALOGUE.md`, section « Temps de pose unitaires (E2-1) »).
 * Même patron que `materials/seed-catalog.data.ts` : ce fichier porte l'état
 * FINAL du registre ; la migration est le rattrapage des bases déjà créées.
 *
 * **Sources.** Chaque ligne cite un document librement consultable —
 * organisation professionnelle, référentiel de formation, guide de mise en
 * œuvre, presse spécialisée, retour public de professionnel. Jamais un
 * bordereau commercial : Batiprix et BatiChiffrage vendent précisément cette
 * donnée, et le spec refuse toute ligne qui les cite. Contrairement à
 * `SeedMaterial`, les champs d'identité de source sont **obligatoires** : un
 * temps de pose n'est jamais définitionnel.
 *
 * **Axes.** `pose_type` est une pose de `POSES_BY_WORK_TYPE[code]`
 * (`estimations/pose-types.ts`). `skill_level` absent = tous niveaux : les
 * sources libres publient des temps de professionnel confirmé ; une ligne par
 * niveau n'existe que si une source la différencie réellement. Pas de grille
 * 7 × poses × 3 fabriquée, pas de table de coefficients : les sources
 * publient des temps, pas des multiplicateurs.
 *
 * **Contrat de résolution (pour E2-2).** `resolve(code, pose, skill)` :
 * 1. ligne exacte `(pose, skill)` ;
 * 2. sinon ligne `(pose, skill absent)` ;
 * 3. sinon ligne `(POSES_BY_WORK_TYPE[code][0], skill absent)` — la ligne de
 *    base, dont le spec garantit l'existence pour chaque ouvrage seedé.
 * La résolution termine donc toujours, sans valeur inventée.
 *
 * **Ce que les temps n'incluent pas** (traitement proposé dans la section du
 * doc) : préparation du support, protection/bâchage, nettoyage de fin de
 * chantier, déplacement.
 */

export type LaborUnitBasis = 'm2' | 'ml' | 'piece';

export type LaborSkillLevel = 'beginner' | 'intermediate' | 'expert';

export interface SeedLaborTime {
  /** Code de l'ouvrage (`work_types.code`, cf. `work-types.data.ts`). */
  work_type_code: string;
  /** Pose de `POSES_BY_WORK_TYPE[work_type_code]`. */
  pose_type: string;
  /** Absent = valable pour tous les niveaux. */
  skill_level?: LaborSkillLevel;
  /** Unité de rattachement du temps. */
  unit_basis: LaborUnitBasis;
  /** Valeur retenue, en heures par unité. */
  hours_per_unit: number;
  /** Fourchette : étalement des chiffres publiés — les deux ou aucune. */
  hours_low?: number;
  hours_high?: number;
  /** Conditions supposées, sans marque. */
  conditions_fr: string;
  /** Organisme/éditeur librement consultable. */
  source_org: string;
  /** Titre du document. */
  source_document: string;
  source_url: string;
  /** Date de consultation, ISO `YYYY-MM-DD`. */
  source_consulted_on: string;
  /** Le chiffre d'origine et sa conversion en h/unité, sans marque. */
  source_basis_fr: string;
}

export const seedLaborTimes: SeedLaborTime[] = [
  // ── Peinture murale ────────────────────────────────────────────────────
  {
    work_type_code: 'wall_painting',
    pose_type: 'standard',
    unit_basis: 'm2',
    hours_per_unit: 0.25,
    hours_low: 0.22,
    hours_high: 0.4,
    conditions_fr:
      'Deux couches acryliques au rouleau sur mur préparé sain, rechampi ' +
      'courant compris, hauteur sous plafond ≤ 2,60 m, pièce vide ; hors ' +
      'impression, préparation du support et protection.',
    source_org: 'Hougard (économie de la construction)',
    source_document: 'Bibliothèque de temps unitaires',
    source_url: 'https://hougard.fr/bibliotheque-de-temps-unitaires',
    source_consulted_on: '2026-08-08',
    source_basis_fr:
      '0,110 h/m² par couche en phase aqueuse au rouleau, léger ponçage ' +
      'compris, et réchampissage 0,130 h/ml — 2 couches ≈ 0,22 h/m², 0,25 ' +
      'retenu avec le rechampi courant ; jusqu’à 0,40 h/m² constaté en ' +
      'chantier complet (300 m² en 100–120 h, retour de professionnel).',
  },
  {
    work_type_code: 'wall_painting',
    pose_type: 'standard',
    skill_level: 'beginner',
    unit_basis: 'm2',
    hours_per_unit: 0.6,
    conditions_fr:
      'Mêmes conditions que la ligne de base, poseur débutant (première ' +
      'expérience de l’ouvrage).',
    source_org: 'Omizi',
    source_document: 'Combien de temps faut-il pour peindre une pièce',
    source_url:
      'https://omizi.com/guides/peintres/combien-de-temps-faut-il-pour-peindre-une-piece',
    source_consulted_on: '2026-08-08',
    source_basis_fr:
      'En application, un professionnel couvre 25 à 35 m²/h contre 10 à ' +
      '15 m²/h pour un particulier — facteur ≈ 2,4 appliqué au temps de ' +
      'base (0,25 h/m²).',
  },

  // ── Peinture plafond ───────────────────────────────────────────────────
  {
    work_type_code: 'ceiling_painting',
    pose_type: 'standard',
    unit_basis: 'm2',
    hours_per_unit: 0.28,
    hours_low: 0.24,
    hours_high: 0.44,
    conditions_fr:
      'Deux couches acryliques au rouleau sur perche, plafond sain, ' +
      'hauteur standard accessible sans échafaudage, pièce vide ; hors ' +
      'impression, préparation et protection.',
    source_org: 'Hougard (économie de la construction)',
    source_document: 'Bibliothèque de temps unitaires',
    source_url: 'https://hougard.fr/bibliotheque-de-temps-unitaires',
    source_consulted_on: '2026-08-08',
    source_basis_fr:
      'Travaux horizontaux à +9 % du vertical à finition égale (0,250 ' +
      'contre 0,230 h/m² en finition C) — 2 couches ≈ 0,24 h/m², 0,28 ' +
      'retenu ; les retours de terrain donnent jusqu’au double du mur ' +
      '(8–10 m²/h contre 15–20 par couche).',
  },
  {
    work_type_code: 'ceiling_painting',
    pose_type: 'standard',
    skill_level: 'beginner',
    unit_basis: 'm2',
    hours_per_unit: 0.7,
    conditions_fr: 'Mêmes conditions que la ligne de base, poseur débutant.',
    source_org: 'Cap-BTP',
    source_document: 'Combien de temps pour peindre un plafond de 20 m²',
    source_url:
      'https://www.cap-btp.com/combien-de-temps-pour-peindre-un-plafond-de-20m2/',
    source_consulted_on: '2026-08-08',
    source_basis_fr:
      'Plafond de 20 m², deux couches : 1 à 3 h de travail actif pour un ' +
      'professionnel contre 5 à 8 h pour un débutant — facteur ≈ 2,5 ' +
      'appliqué au temps de base (0,28 h/m²).',
  },

  // ── Carrelage sol ──────────────────────────────────────────────────────
  {
    work_type_code: 'floor_tiling',
    pose_type: 'straight',
    unit_basis: 'm2',
    hours_per_unit: 0.8,
    hours_low: 0.45,
    hours_high: 1.25,
    conditions_fr:
      'Grès cérame 45 × 45 en double encollage sur support préparé plan, ' +
      'pose droite, joints compris, pièce vide ; hors ragréage, primaire, ' +
      'plinthes et système d’étanchéité.',
    source_org: 'Meilleur-Artisan (carreleurs professionnels)',
    source_document:
      'Quel temps met un carreleur professionnel pour poser un m² de carrelage',
    source_url:
      'https://www.meilleur-artisan.com/discussion/quel-temps-met-un-carreleur-professionnel-pour-poser-un-m2-de-carrelage.41877.html',
    source_consulted_on: '2026-08-08',
    source_basis_fr:
      'Pose seule 30 à 45 min/m² et jointoiement 20 à 30 min/m² annoncés ' +
      'par des carreleurs en exercice (0,83 à 1,25 h/m²) ; les cadences ' +
      'journalières publiées (15 à 25 m²/jour) donnent 0,45 à 0,80 h/m² — ' +
      '0,80 retenu joints compris.',
  },
  {
    work_type_code: 'floor_tiling',
    pose_type: 'straight',
    skill_level: 'beginner',
    unit_basis: 'm2',
    hours_per_unit: 1.6,
    conditions_fr: 'Mêmes conditions que la ligne de base, poseur débutant.',
    source_org: 'Esprit Brico',
    source_document: 'Temps de pose du carrelage',
    source_url: 'https://espritbrico.fr/temps-pose-carrelage/',
    source_consulted_on: '2026-08-08',
    source_basis_fr:
      'Débutant : 5 à 8 m² par jour en pose pure (1,0 à 1,6 h/m²) contre ' +
      '10 à 20 m²/jour pour un professionnel — 1,60 h/m² retenu pour ' +
      'l’ouvrage joints compris.',
  },
  {
    work_type_code: 'floor_tiling',
    pose_type: 'diagonal',
    unit_basis: 'm2',
    hours_per_unit: 1.2,
    hours_low: 0.95,
    hours_high: 1.6,
    conditions_fr:
      'Mêmes conditions que la pose droite, calepinage en diagonale : ' +
      'traçage préalable et découpes d’angle sur toute la périphérie.',
    source_org: 'Rénovation Habitat',
    source_document: 'Pose de carrelage en diagonale',
    source_url:
      'https://www.renovation-habitat.info/pose-carrelage-en-diagonale',
    source_consulted_on: '2026-08-08',
    source_basis_fr:
      'Cadences publiées : 8 à 12 m²/jour en pose droite contre 2 à ' +
      '5 m²/jour annoncés en diagonale ; les prix de main-d’œuvre publiés ' +
      'majorent la diagonale de +20 à +50 % — +50 % retenu sur la pose ' +
      'droite (1,20 h/m²), borne haute au doublement du temps.',
  },

  // ── Carrelage mural ────────────────────────────────────────────────────
  {
    work_type_code: 'wall_tiling',
    pose_type: 'straight',
    unit_basis: 'm2',
    hours_per_unit: 1.2,
    hours_low: 0.8,
    hours_high: 1.6,
    conditions_fr:
      'Faïence 25 × 40 en pose droite sur mur préparé, local humide type ' +
      'salle de bain, découpes autour des points d’eau, joints compris ; ' +
      'hors système d’étanchéité et préparation du support.',
    source_org: 'BG Habitat Conseil',
    source_document: 'Combien de m² pose un carreleur par jour',
    source_url:
      'https://www.bghabitatconseil.fr/combien-m2-pose-carreleur-jour/',
    source_consulted_on: '2026-08-08',
    source_basis_fr:
      '5 à 15 m²/jour en faïence murale (petites pièces, découpes, ' +
      'exigence d’alignement), soit 0,53 à 1,6 h/m² — 1,20 retenu, ' +
      'cohérent avec le ratio ×2 entre mur et sol rapporté par les ' +
      'carreleurs.',
  },
  {
    work_type_code: 'wall_tiling',
    pose_type: 'straight',
    skill_level: 'beginner',
    unit_basis: 'm2',
    hours_per_unit: 2.2,
    hours_low: 1.6,
    hours_high: 2.7,
    conditions_fr: 'Mêmes conditions que la ligne de base, poseur débutant.',
    source_org: 'Ain Carrelages',
    source_document: 'Combien de temps pour poser du carrelage',
    source_url:
      'https://www.ain-carrelages.com/blog/combien-de-temps-pour-poser-du-carrelage-n101',
    source_consulted_on: '2026-08-08',
    source_basis_fr:
      'Une journée environ pour la pose de 3 à 5 m² de carrelage mural ' +
      'par un poseur non professionnel, soit 1,6 à 2,7 h/m² — 2,20 retenu.',
  },

  // ── Parquet ou stratifié ───────────────────────────────────────────────
  {
    work_type_code: 'parquet_flooring',
    pose_type: 'straight',
    unit_basis: 'm2',
    hours_per_unit: 0.3,
    hours_low: 0.15,
    hours_high: 0.45,
    conditions_fr:
      'Stratifié ou contrecollé clipsé en pose flottante droite sur ' +
      'sous-couche, support plan, pièce vide ; hors préparation du ' +
      'support, plinthes et barres de seuil.',
    source_org: 'Ynspir',
    source_document: 'Prix de pose du parquet au m²',
    source_url:
      'https://ynspir.com/conseils-decoration/renovation/prix-renovation/prix-de-pose-du-parquet-au-m2/',
    source_consulted_on: '2026-08-08',
    source_basis_fr:
      '20 à 30 m² posés par jour par un poseur expérimenté (0,23 à ' +
      '0,35 h/m²) — 0,30 retenu ; bornes publiées à 0,15 (20 m² en 3–4 h ' +
      'constaté) et 0,45 (pièce de 20 m² en une journée, aménagements ' +
      'compris).',
  },
  {
    work_type_code: 'parquet_flooring',
    pose_type: 'straight',
    skill_level: 'beginner',
    unit_basis: 'm2',
    hours_per_unit: 0.5,
    hours_low: 0.35,
    hours_high: 0.8,
    conditions_fr: 'Mêmes conditions que la ligne de base, poseur débutant.',
    source_org: 'Fait Pour Vous',
    source_document: 'Comment poser du parquet flottant',
    source_url: 'https://www.faitpourvous.fr/bricolage/poser-parquet-flottant',
    source_consulted_on: '2026-08-08',
    source_basis_fr:
      'Bricoleur expérimenté : 15 à 20 m² par jour (0,35 à 0,47 h/m²) ; ' +
      'débutant : 1 à 2 jours pour une pièce de 20 m², préparation ' +
      'incluse — 0,50 retenu.',
  },
  {
    work_type_code: 'parquet_flooring',
    pose_type: 'herringbone',
    unit_basis: 'm2',
    hours_per_unit: 1,
    hours_low: 0.47,
    hours_high: 1.75,
    conditions_fr:
      'Contrecollé ou stratifié dédié posé en bâton rompu, collé ou ' +
      'clipsé, support plan préparé, pièce vide ; hors préparation, ' +
      'plinthes et barres de seuil.',
    source_org: 'Domindo',
    source_document:
      'Parquet bâton rompu : pourquoi la pose est-elle plus chère',
    source_url: 'https://www.domindo.fr/parquet-baton-rupt-pose-coute',
    source_consulted_on: '2026-08-08',
    source_basis_fr:
      'Cadence à deux : 8 à 12 m²/jour en bâton rompu contre 15 à 25 en ' +
      'pose droite (1,17 à 1,75 h·homme/m²) ; un fabricant annonce ' +
      '15 m²/jour seul (≈ 0,47) — 1,00 retenu, corroboré par un chantier ' +
      'réel (110 m² en 5–6 jours à 3 poseurs).',
  },

  // ── Cloison sèche ──────────────────────────────────────────────────────
  {
    work_type_code: 'drywall',
    pose_type: 'standard',
    unit_basis: 'm2',
    hours_per_unit: 0.95,
    hours_low: 0.8,
    hours_high: 1.1,
    conditions_fr:
      'Cloison 72/48 : ossature métallique montants entraxe 60 cm, laine ' +
      '45 mm, un BA13 par face, joints bandes et enduit sur les deux ' +
      'faces compris, par m² de cloison, hauteur standard ; hors ' +
      'nettoyage et finitions de peinture. Temps de séchage entre passes ' +
      'non comptés.',
    source_org: 'Matiso',
    source_document: 'Combien de temps pour monter une cloison',
    source_url:
      'https://www.matiso.fr/combien-de-temps-pour-monter-une-cloison',
    source_consulted_on: '2026-08-08',
    source_basis_fr:
      'Pose 4 à 6 h et finitions joints 4 à 5 h pour 10 m² de cloison ' +
      '(0,8 à 1,1 h/m²) — 0,95 retenu ; borne cohérente avec le temps ' +
      'unitaire d’étude de prix d’une cloison acoustique double parement ' +
      '(1,10 h/m², sujet officiel de BTS Aménagement Finition).',
  },
  {
    work_type_code: 'drywall',
    pose_type: 'standard',
    skill_level: 'beginner',
    unit_basis: 'm2',
    hours_per_unit: 1.5,
    hours_low: 1.2,
    hours_high: 1.7,
    conditions_fr: 'Mêmes conditions que la ligne de base, poseur débutant.',
    source_org: 'Matiso',
    source_document: 'Combien de temps pour monter une cloison',
    source_url:
      'https://www.matiso.fr/combien-de-temps-pour-monter-une-cloison',
    source_consulted_on: '2026-08-08',
    source_basis_fr:
      'Poseur débutant : 8 à 12 h de pose et 4 à 5 h de finitions pour ' +
      '10 m² (1,2 à 1,7 h/m², séchages non compris) — 1,50 retenu.',
  },

  // ── Revêtement mural ───────────────────────────────────────────────────
  {
    work_type_code: 'wall_covering',
    pose_type: 'standard',
    unit_basis: 'm2',
    hours_per_unit: 0.25,
    hours_low: 0.15,
    hours_high: 0.35,
    conditions_fr:
      'Intissé sur mur préparé, colle appliquée au mur, raccord simple, ' +
      'hauteur sous plafond ≤ 2,60 m, pièce vide ; hors dépose de ' +
      'l’ancien revêtement, préparation du support et temps de séchage.',
    source_org: 'Mon Papier Peint',
    source_document: 'Guide de pose du papier peint intissé',
    source_url:
      'https://www.monpapierpeint.com/blogs/journal/guide-pose-papier-peint-intisse',
    source_consulted_on: '2026-08-08',
    source_basis_fr:
      '2 à 3 heures pour un mur de 10 m² posé seul (0,20 à 0,30 h/m²) — ' +
      '0,25 retenu ; bornes publiées à 0,15 (20 m² en moins de 3 h, ' +
      'poseur aguerri) et 0,35 (temps chantier complet constaté par les ' +
      'plateformes d’artisans).',
  },
  {
    work_type_code: 'wall_covering',
    pose_type: 'standard',
    skill_level: 'beginner',
    unit_basis: 'm2',
    hours_per_unit: 0.5,
    hours_low: 0.4,
    hours_high: 0.6,
    conditions_fr: 'Mêmes conditions que la ligne de base, poseur débutant.',
    source_org: 'Le Monde du Papier Peint',
    source_document: 'Combien de temps pour poser du papier peint',
    source_url:
      'https://lemondedupapierpeint.fr/blogs/blog/combien-de-temps-pour-poser-du-papier-peint',
    source_consulted_on: '2026-08-08',
    source_basis_fr:
      'Barème publié : 10 m² en 2 à 3 h pour un poseur expérimenté ' +
      'contre 4 à 6 h pour un débutant (0,40 à 0,60 h/m²) — 0,50 retenu.',
  },
];
