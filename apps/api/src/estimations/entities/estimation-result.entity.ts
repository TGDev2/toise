import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';

/**
 * Un format et son nombre de contenants dans un achat panaché (E1-5).
 * Miroir de `PackagingUnits` du moteur, redéclaré ici pour que le contrat
 * persisté ne dépende pas d'un type interne au calcul.
 */
export interface PackagingUnitsLine {
  label: string;
  units: number;
}

/**
 * E1-11 — pourquoi cette quantité est celle-ci : le ratio, sa source, et la
 * règle appliquée à l'exécution (double encollage déclenché, pare-vapeur
 * requis…), composées une fois par le moteur
 * (`estimations/material-justification.ts`) et copiées verbatim à chaque
 * saut — `EstimationLineItem` → `AggregatedMaterialLine` →
 * `ShoppingListMaterialItem` → `QuoteLineItem` — exactement comme
 * `inclusion_reason_fr`.
 *
 * `text_unbranded_fr` est **toujours** renseignée, égale à `text_fr` quand
 * il n'y a rien à masquer (rendement définitionnel) : le choix entre les
 * deux, au moment de répondre à un client, devient une fonction totale
 * (`materials/render-justification.ts::pickJustification`) sans `??` qu'on
 * puisse oublier — une fuite de marque est le risque asymétrique de ce
 * champ.
 */
export interface MaterialJustification {
  /** Phrase affichable telle quelle, marque comprise. 1 à 2 phrases. */
  text_fr: string;
  /** Même contenu, marque/produit/URL retirés. */
  text_unbranded_fr: string;
  /** Fiche citée. Absent si rendement définitionnel. */
  source_url?: string;
}

export interface EstimationLineItem {
  work_item_id: string;
  work_type_code: string;
  work_type_label: string;
  material_id: string;
  material_name: string;
  material_unit: string;
  gross_surface_m2: number;
  surface_m2: number;
  theoretical_qty: number;
  waste_factor_percent: number;
  /** `learned` : facteur recalculé sur les achats réels (DATA-3). */
  waste_factor_source: 'catalog' | 'default' | 'learned';
  adjusted_qty: number;
  /**
   * Libellé de l'achat : le format seul, ou l'assortiment composé quand
   * plusieurs formats sont panachés (« Pot 5 L + Pot 2.5 L », E1-5).
   */
  packaging_label: string;
  /**
   * Contenu moyen par contenant. Égal au format exact tant qu'un seul format
   * est retenu ; sur un achat panaché, c'est la valeur qui garde vrai
   * `units_needed × packaging_qty_per_unit = volume acheté`.
   */
  packaging_qty_per_unit: number;
  /** Nombre total de contenants, tous formats confondus. */
  units_needed: number;
  /**
   * Détail de l'achat quand plusieurs formats sont panachés (E1-5), du plus
   * grand au plus petit. Absent sur un achat à format unique — le couple
   * (`packaging_label`, `units_needed`) le dit alors entièrement — et sur toute
   * ligne calculée avant E1-5.
   */
  packaging_breakdown?: PackagingUnitsLine[];
  pose_type: string;
  /**
   * E2-2 — le niveau déclaré sur **cet** ouvrage, à côté de sa pose et pour la
   * même raison : ce sont les deux axes du registre des temps de pose
   * (`labor_times`), et le devis les lit sur la ligne.
   *
   * Pourquoi ici et pas sur `EstimationResult.skill_level` : cette colonne ne
   * retient que le niveau du **premier** ouvrage rencontré
   * (`estimations.service.ts`, `firstSkillLevel`). S'en servir pour chiffrer la
   * main-d'œuvre donnerait le niveau du salon à la salle de bain — un champ à
   * deux sens (leçon 18). Le moteur, lui, résout déjà ses pertes avec le niveau
   * de chaque ouvrage : la ligne le porte désormais aussi.
   *
   * Absent sur toute estimation calculée avant E2-2 ; l'appelant retombe alors
   * sur `EstimationResult.skill_level`, qui reste la meilleure valeur connue.
   */
  skill_level?: string;
  /**
   * E1-8 — pourquoi cette ligne est là, quand sa présence même est le résultat
   * d'une condition. Renseignée aujourd'hui sur le seul film pare-vapeur : sa
   * jumelle est `MaterialExclusion.reason_fr`, qui dit pourquoi une ligne n'y
   * est pas. Absente sur tout matériau inconditionnel, c'est-à-dire sur tout le
   * reste du catalogue.
   */
  inclusion_reason_fr?: string;
  /**
   * E1-11 — cf. `MaterialJustification`. Absente si le matériau ne porte
   * aucune source (`materials_catalog.source_basis_fr` nul) — un chiffrage
   * antérieur à ce lot, ou un matériau qu'aucune migration n'a encore
   * documenté.
   */
  justification?: MaterialJustification;
  /**
   * E1-8 — pièces à découper, pour un matériau dont les chutes ne se
   * réutilisent pas (`materials_catalog.offcuts_reusable = false`). Absent sur
   * tout matériau aboutable, c'est-à-dire tout le catalogue hors montants et
   * fourrures.
   *
   * Sa présence dit que `units_needed` vient d'un **comptage** et non d'une
   * division : la mutualisation multi-pièces doit alors sommer des pièces, pas
   * des mètres — sommer les linéaires puis diviser réintroduirait exactement le
   * défaut corrigé (deux cloisons de 8 emplacements donneraient 15 barres).
   */
  pieces_needed?: number;
  /** Longueur d'une pièce, en mètres. Va avec `pieces_needed`. */
  piece_length_m?: number;
  /** Pièces qu'une barre du format retenu donne. Va avec `pieces_needed`. */
  pieces_per_bar?: number;
  number_of_coats?: number;
  /** Aire déduite via les exclusions manuelles (ENG-3). Absent/0 → aucune. */
  excluded_surface_m2?: number;
  /** Pièce d'origine (ENG-2). Absent → estimation mono-pièce (legacy/public). */
  room_id?: string;
  room_name?: string;
  /**
   * Fourchette basse/haute (CV-5), présente uniquement si la pièce porte une
   * incertitude de mesure connue (dimensions `source='cv'`). Absente pour une
   * pièce en saisie manuelle ou une ligne antérieure à cette fonctionnalité.
   */
  surface_m2_low?: number;
  surface_m2_high?: number;
  adjusted_qty_low?: number;
  adjusted_qty_high?: number;
  units_needed_low?: number;
  units_needed_high?: number;
}

/**
 * E1-8 — un matériau **lié à l'ouvrage mais non chiffré**, et le motif.
 *
 * Il n'y en avait aucun avant ce lot : tout matériau lié produisait une ligne,
 * au point que le harnais en faisait un invariant (`[I0]`, « autant de lignes
 * que de matériaux liés »). Le pare-vapeur casse cette égalité pour une bonne
 * raison — sur un plancher bois, il n'a pas lieu d'être — et l'égalité devient
 * « lignes + exclusions = matériaux liés ».
 *
 * Le motif est **codé et rédigé**. Le code sert aux tests et à un éventuel
 * filtrage ; la phrase va à l'écran telle quelle, parce que la traduire côté web
 * écrirait la règle une seconde fois, dans une seconde langue de programme, avec
 * une seconde occasion de diverger.
 */
export interface MaterialExclusion {
  work_item_id: string;
  work_type_code: string;
  work_type_label: string;
  material_id: string;
  material_name: string;
  reason_code: string;
  reason_fr: string;
  /** Pièce d'origine (ENG-2). Absent → estimation mono-pièce. */
  room_id?: string;
  room_name?: string;
}

/**
 * Contribution d'une (pièce × work item) à la demande agrégée d'un matériau.
 * Conserve la traçabilité par pièce (affichage + coût « brut » du budget).
 */
export interface PurchaseContribution {
  room_id?: string;
  room_name?: string;
  work_item_id: string;
  work_type_code: string;
  surface_m2: number;
  adjusted_qty: number;
}

/**
 * Ligne d'achat mutualisée (ENG-2) : un matériau, sommé sur toutes les pièces
 * et tous les work items, avec le conditionnement choisi **une seule fois** sur
 * la quantité totale continue — donc jamais plus cher qu'un achat pièce par
 * pièce, au sens du critère d'E1-5. En nombre de contenants, en revanche,
 * l'achat mutualisé peut être plus grand : cf. `EstimationEngine.aggregatePurchases`.
 */
export interface AggregatedMaterialLine {
  material_id: string;
  material_name: string;
  material_unit: string;
  work_type_code: string;
  work_type_label: string;
  total_adjusted_qty: number;
  packaging_label: string;
  packaging_qty_per_unit: number;
  units_needed: number;
  /** Cf. `EstimationLineItem.packaging_breakdown` (E1-5). */
  packaging_breakdown?: PackagingUnitsLine[];
  room_count: number;
  contributions: PurchaseContribution[];
  /**
   * E1-11 — cf. `MaterialJustification`. Copiée seulement si **identique**
   * sur toutes les contributions mutualisées (même matériau, même
   * `text_fr`) : deux pièces qui posent des géométries de carreau
   * différentes produisent des justifications différentes pour le même
   * matériau, et une ligne mutualisée ne peut pas en porter deux à la fois.
   * Omise plutôt qu'une phrase composite inventée — le détail par pièce
   * reste lisible sur l'écran d'estimation granulaire (`contributions`).
   */
  justification?: MaterialJustification;
  /**
   * Fourchette basse/haute (CV-5) : conditionnement sélectionné indépendamment
   * sur la somme basse et la somme haute des contributions (même logique que
   * `units_needed`, recalculée sur le total plutôt que sommée ligne à ligne).
   * Présente seulement si au moins une contribution porte une fourchette.
   */
  units_needed_low?: number;
  units_needed_high?: number;
}

@Entity('estimation_results')
export class EstimationResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  project_id!: string;

  @Column({ type: 'varchar', length: 20 })
  skill_level!: string;

  @Column({ type: 'jsonb' })
  items_json!: EstimationLineItem[];

  /**
   * Plan d'achat mutualisé (ENG-2) : 1 ligne par matériau, conditionnement
   * choisi une fois sur la quantité sommée. `null` pour les estimations
   * antérieures à ENG-2 (la liste d'achats retombe alors sur `items_json`).
   */
  @Column({ type: 'jsonb', nullable: true, default: null })
  aggregated_json!: AggregatedMaterialLine[] | null;

  /**
   * E1-8 — matériaux liés que l'ouvrage n'a pas demandés, avec leur motif.
   * `null` pour les estimations antérieures à ce lot ; un tableau vide pour un
   * chiffrage où rien n'a été écarté. La nuance compte à l'écran : « aucune
   * exclusion » et « on ne sait pas » ne se disent pas de la même façon.
   */
  @Column({ type: 'jsonb', nullable: true, default: null })
  exclusions_json!: MaterialExclusion[] | null;

  @Column({ type: 'integer', default: 0 })
  total_items!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;
}
