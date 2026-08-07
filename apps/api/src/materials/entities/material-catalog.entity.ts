import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MaterialPackaging } from './material-packaging.entity';
import { WasteFactor } from './waste-factor.entity';
import { MaterialEcoEquivalence } from './material-eco-equivalence.entity';
import { numericTransformer } from '../../common/transformers/numeric.transformer';

/**
 * E1-3 — sur quoi la quantité d'un matériau se métré, c'est-à-dire **dans quelle
 * unité `yield_per_unit` est exprimé**. Les deux vont ensemble et vivent dans la
 * même ligne : les séparer laisserait un rendement dire une chose et son
 * assiette une autre. Même décision qu'`applies_coats` (E1-4) et pour la même
 * raison — une règle de quantité se porte par la donnée du matériau, jamais par
 * une condition sur la catégorie ou le code de l'ouvrage.
 *
 *  - `work_surface` : la surface de l'ouvrage, qu'elle soit dérivée de la pièce
 *    (`surface_target`) ou déclarée. Défaut, et le seul cas hors plâtrerie.
 *  - `clad_faces` : cette surface **multipliée par le nombre de faces à
 *    parementer**. Une cloison de 10 m² parementée deux faces, c'est 20 m² de
 *    parement — plaques, vis, bande à joint, enduits.
 *  - `frame_runner` : la longueur cumulée des lisses (`runner_courses` fois la
 *    longueur de l'ouvrage), en mètres. Rails.
 *  - `frame_stud` : la longueur cumulée des montants (nombre de montants fois
 *    la hauteur), en mètres. Montants, fourrures.
 *
 * Les deux dernières ne dépendent **pas** du nombre de faces : une cloison
 * parementée deux faces n'a qu'une seule trame. C'est tout l'objet de ce champ.
 */
export type MaterialQuantityDriver =
  | 'work_surface'
  | 'clad_faces'
  | 'frame_runner'
  | 'frame_stud';

/**
 * E1-5 — loi qui fait varier la consommation d'un matériau avec la géométrie du
 * carreau posé. Déclarée ici, aux côtés de `MaterialQuantityDriver` et pour la
 * même raison : c'est une propriété du **matériau**, et c'est elle qui donne son
 * sens à `yield_per_unit`. La loi elle-même, ses tables et ses sources vivent
 * dans `estimations/tile-consumption.ts` ; l'entité n'en connaît que le nom.
 *
 *  - `tile_adhesive` : mortier-colle. La consommation suit le peigne, que le
 *    format du carreau sélectionne, et le mode d'encollage, que le NF DTU 52.2
 *    impose au-delà d'un seuil de surface.
 *  - `tile_grout` : mortier de jointoiement. La consommation suit le volume de
 *    joint sous un m², donc les dimensions du carreau, son épaisseur et la
 *    largeur de joint saisie.
 */
export type TileConsumptionModel = 'tile_adhesive' | 'tile_grout';

export enum MaterialCategory {
  PAINTING = 'painting',
  TILING = 'tiling',
  FLOORING = 'flooring',
  PARTITION = 'partition',
  WALL_COVERING = 'wall_covering',
}

@Entity('materials_catalog')
export class MaterialCatalog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 30 })
  category!: MaterialCategory;

  @Column({ type: 'varchar', length: 20 })
  unit!: string;

  /**
   * Quantité d'assiette couverte par une unité, **dans l'unité que désigne
   * `quantity_driver`** : m² de surface d'ouvrage, m² de parement, ou mètre de
   * trame. Les deux colonnes se lisent ensemble.
   */
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 4,
    transformer: numericTransformer,
  })
  yield_per_unit!: number;

  /**
   * E1-3 — sur quoi la quantité se métré. `work_surface` (défaut) : la surface
   * de l'ouvrage. `clad_faces` : cette surface multipliée par le nombre de
   * faces à parementer — plaques, vis, bande, enduit. `frame_runner` /
   * `frame_stud` : la longueur de lisse ou de montant de la trame, qui ne
   * dépend **pas** du nombre de faces (une cloison parementée deux faces n'a
   * qu'une seule ossature).
   *
   * Porté par le matériau et non par la liaison ouvrage → matériau, pour la
   * même raison qu'`applies_coats` : ce champ définit l'unité de
   * `yield_per_unit`, et deux lignes qui se contrediraient donneraient un
   * chiffrage faux sans que rien ne le signale.
   */
  @Column({ type: 'varchar', length: 20, default: 'work_surface' })
  quantity_driver!: MaterialQuantityDriver;

  /**
   * E1-4 — la quantité de ce matériau est proportionnelle au nombre de couches
   * saisi (`custom_params.number_of_coats`). Vrai des seuls revêtements
   * appliqués en couches successives sur la surface : peintures, lasures,
   * vernis. Faux pour tout le reste — accessoires, consommables, enduits, et
   * les sous-couches, qui s'appliquent en une passe quel que soit le nombre de
   * couches de finition.
   *
   * Remplace la déduction `category === 'painting'` du moteur, qui commandait
   * un pinceau autant de fois qu'il y avait de mètres carrés et de couches.
   */
  @Column({ type: 'boolean', default: false })
  applies_coats!: boolean;

  /**
   * E1-5 — loi de consommation de ce matériau en fonction de la géométrie du
   * carreau posé. `NULL` (le défaut) : la consommation ne dépend d'aucun
   * carreau, `yield_per_unit` vaut tel quel — c'est le cas de tout le catalogue
   * hors mortiers-colle et mortiers de jointoiement.
   *
   * Quand la colonne est renseignée, `yield_per_unit` est le rendement à la
   * **géométrie de référence du modèle** (`estimations/tile-consumption.ts`,
   * citée ligne à ligne dans `docs/SOURCES_CATALOGUE.md`), et le moteur en
   * dérive le rendement effectif du carreau réellement choisi. Le catalogue
   * garde donc le niveau, le moteur porte la forme : rien n'est décrit deux
   * fois.
   *
   * Portée par le matériau et non par la liaison ouvrage → matériau, pour la
   * même raison qu'`applies_coats` et que `quantity_driver` : ce champ décide
   * de la signification de `yield_per_unit`, et deux lignes qui se
   * contrediraient donneraient un chiffrage faux sans que rien ne le signale.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  consumption_model!: TileConsumptionModel | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'boolean', default: false })
  is_eco!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  eco_label_fr!: string | null;

  @Column({ type: 'uuid', nullable: true })
  modified_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  modified_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @OneToMany(() => MaterialPackaging, (p) => p.material, { cascade: true })
  packagings!: MaterialPackaging[];

  @OneToMany(() => WasteFactor, (w) => w.material, { cascade: true })
  waste_factors!: WasteFactor[];

  @OneToMany(() => MaterialEcoEquivalence, (e) => e.standardMaterial)
  eco_equivalents!: MaterialEcoEquivalence[];

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'modified_by' })
  modifier!: User | null;
}
