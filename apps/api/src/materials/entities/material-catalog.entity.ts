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
 *
 * E1-10 ajoute deux assiettes qui ne sont ni une surface ni une trame :
 *
 *  - `floor_perimeter` : le linéaire du contour au sol de la pièce, **portes
 *    déduites**, en mètres. Plinthes, joints périphériques, bandes de jonction
 *    sol/mur — tout ce qui court le long des murs et s'interrompt aux passages.
 *  - `door_count` : le nombre de passages de porte de la pièce. Barres de
 *    seuil. `yield_per_unit` dit combien de passages une unité couvre (1 pour
 *    une barre).
 *
 * Ces deux assiettes sont dérivées de la pièce : un ouvrage à assiette
 * déclarée (cloison créée) ne les connaît pas, et un matériau qui s'y métré
 * lié à un tel ouvrage fait échouer le chiffrage bruyamment — même règle que
 * `frame_runner` sans `frame_spec`.
 */
export type MaterialQuantityDriver =
  | 'work_surface'
  | 'clad_faces'
  | 'frame_runner'
  | 'frame_stud'
  | 'floor_perimeter'
  | 'door_count';

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
 *  - `tile_spacers` (E1-10) : croisillons. Un croisillon par intersection de
 *    joints, soit autant que de carreaux par m² — un pur fait de calepinage,
 *    insensible à la largeur de joint et au sens de pose.
 */
export type TileConsumptionModel =
  | 'tile_adhesive'
  | 'tile_grout'
  | 'tile_spacers';

/**
 * E1-8 — rôle d'un matériau vis-à-vis du pare-vapeur d'un sol posé en flottant.
 *
 * Une seule colonne pour deux faits, parce qu'ils sont exclusifs et qu'un
 * matériau ne peut pas être les deux : deux booléens autoriseraient l'état
 * « film dédié qui intègre un pare-vapeur », qui ne veut rien dire, et il
 * faudrait alors écrire quelque part qu'il est interdit.
 *
 *  - `dedicated` : ce matériau **est** le pare-vapeur — un film nu, sans autre
 *    fonction. C'est le seul rôle qui rende un matériau **conditionnel** : il
 *    n'est chiffré que si l'ouvrage en a besoin et qu'aucun autre ne le fournit.
 *  - `integrated` : ce matériau en **porte** un — une sous-couche à pare-vapeur
 *    intégré. Il satisfait le besoin, donc il rend le film dédié inutile.
 *  - `NULL` : sans rapport. Tout le reste du catalogue.
 *
 * Portée par le matériau et non par la liaison ouvrage → matériau, pour la même
 * raison qu'`applies_coats`, `quantity_driver` et `consumption_model` : c'est
 * une propriété du produit, pas de son emploi. Une sous-couche qui intègre un
 * pare-vapeur l'intègre sur tous les chantiers.
 */
export type VapourBarrierRole = 'dedicated' | 'integrated';

/**
 * E1-10 — rôle d'un matériau dans le système d'étanchéité d'un local exposé à
 * l'eau (NF DTU 52.2, locaux EB+). Même mécanique que `VapourBarrierRole` :
 * la colonne dit le rôle du produit, la règle vit dans
 * `estimations/wet-room.ts`, et la condition — l'exposition à l'eau du local —
 * est une réponse de l'utilisateur (`custom_params.water_exposure`).
 *
 *  - `sel` : le Système d'Étanchéité Liquide lui-même, appliqué sur la surface
 *    d'ouvrage avant carrelage.
 *  - `sealing_band` : la bande de renfort marouflée dans la première couche le
 *    long des jonctions sol/mur — elle suit le périmètre, pas la surface.
 *  - `NULL` : sans rapport. Tout le reste du catalogue.
 */
export type WetRoomRole = 'sel' | 'sealing_band';

/**
 * E1-10 — rôle d'un matériau dans la préparation d'un sol dont la planéité est
 * insuffisante (défauts > 5 mm sous la règle de 2 m, seuil des NF DTU 52.2 et
 * 51.11). Même mécanique : la condition est une réponse de l'utilisateur
 * (`custom_params.floor_flatness`), la règle vit dans
 * `estimations/floor-prep.ts`.
 *
 *  - `leveling_compound` : le ragréage lui-même.
 *  - `leveling_primer` : le primaire d'accrochage que les fiches de ragréage
 *    prescrivent avant application. Il suit le ragréage : pas de ragréage,
 *    pas de primaire.
 *  - `NULL` : sans rapport. Tout le reste du catalogue.
 */
export type SubstratePrep = 'leveling_compound' | 'leveling_primer';

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

  /**
   * E1-6 — dimensions du rouleau dans lequel ce matériau se débite, en
   * centimètres. `NULL` (le défaut) pour tout matériau qui ne se pose pas en
   * lés, c'est-à-dire tout le catalogue hors revêtements muraux en rouleau.
   *
   * Leur **présence** bascule le matériau sur le calcul en lés
   * (`estimations/wallpaper-strips.ts`) : le moteur en dérive le nombre de lés
   * qu'un rouleau donne pour la hauteur sous plafond posée, et n'utilise plus
   * `yield_per_unit`. Les deux colonnes vont donc ensemble et se renseignent
   * ensemble — un matériau ne peut pas se dire « en lés » sans dire de quel
   * rouleau, ce qui rend impossible le repli silencieux sur le calcul
   * surfacique, le défaut que ce lot corrige.
   *
   * Portées par le matériau et non par le moteur pour une raison factuelle : le
   * catalogue V1 contient déjà des conditionnements différents — papiers peints
   * en 10,05 × 0,53 m, papier d'apprêt en 10 × 0,50 m. Une constante de moteur
   * aurait chiffré le second comme le premier.
   *
   * Contrainte de cohérence, éprouvée par `wallpaper-strips.spec.ts` : le
   * conditionnement d'un tel matériau doit valoir exactement
   * `roll_width_cm × roll_length_cm`, sinon l'arrondi au contenant rachèterait
   * un rouleau sur un besoin qui tombe juste.
   */
  @Column({
    type: 'numeric',
    precision: 8,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  roll_width_cm!: number | null;

  /** Longueur du rouleau, en cm. Cf. `roll_width_cm`. */
  @Column({
    type: 'numeric',
    precision: 8,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  roll_length_cm!: number | null;

  /**
   * E1-8 — rôle de ce matériau vis-à-vis du pare-vapeur (cf.
   * `VapourBarrierRole`). `NULL` (le défaut) pour tout le catalogue hors films
   * pare-vapeur et sous-couches à pare-vapeur intégré.
   *
   * C'est la première colonne du catalogue qui décide de la **présence** d'une
   * ligne et non de sa quantité. La règle qu'elle porte vit dans
   * `estimations/vapour-barrier.ts` ; l'entité n'en connaît que le rôle, comme
   * pour `consumption_model`.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  vapour_barrier!: VapourBarrierRole | null;

  /**
   * E1-10 — rôle de ce matériau dans le système d'étanchéité d'un local exposé
   * à l'eau (cf. `WetRoomRole`). `NULL` (le défaut) pour tout le catalogue hors
   * SEL et bandes de renfort. Deuxième colonne, après `vapour_barrier`, qui
   * décide de la **présence** d'une ligne : un matériau marqué n'est chiffré
   * que si le local est déclaré exposé à l'eau (`estimations/wet-room.ts`).
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  wet_room_system!: WetRoomRole | null;

  /**
   * E1-10 — rôle de ce matériau dans la préparation d'un sol non plan (cf.
   * `SubstratePrep`). `NULL` (le défaut) pour tout le catalogue hors ragréages
   * et primaires de ragréage. Un matériau marqué n'est chiffré que si la
   * planéité déclarée l'exige (`estimations/floor-prep.ts`).
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  substrate_prep!: SubstratePrep | null;

  /**
   * E1-8 — les chutes de ce matériau se réutilisent-elles **bout à bout** ?
   *
   * `true` (le défaut) : le matériau est **aboutable**. Ce qui reste d'une barre
   * se raboute au début de la suivante, donc le besoin est un linéaire continu
   * et l'achat en est la division par la longueur de barre. C'est le cas des
   * rails, posés en course continue au sol et au plafond.
   *
   * `false` : le matériau est **découpé à longueur**, et la chute est perdue.
   * Sous un plafond de 2,50 m, une barre de montant de 2,70 m donne **un**
   * montant, pas 1,08 : les 0,20 m qui restent ne se ressoudent pas. Le juste
   * compte est alors un nombre de **pièces**, pas un linéaire — et le moteur
   * cesse de diviser (`estimations/piece-cutting.ts`).
   *
   * Conséquence sur la perte, écrite ici parce qu'elle surprend : un matériau
   * non aboutable a sa chute **mesurée** et non estimée, donc il ne porte plus
   * de forfait de coupe. Lui en ajouter un compterait deux fois la même chute —
   * le double comptage qu'E1-7 a retiré aux mortiers-colle.
   */
  @Column({ type: 'boolean', default: true })
  offcuts_reusable!: boolean;

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
