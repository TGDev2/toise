import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MaterialCatalog } from '../../materials/entities/material-catalog.entity';
import type { FeedAvailability } from '../matching/material-product-matcher';
import { numericTransformer } from '../../common/transformers/numeric.transformer';

/**
 * Rapprochement retenu entre un matériau du catalogue et un produit du flux
 * d'affiliation d'une enseigne.
 *
 * Le flux marchand n'est jamais recopié en base : la synchronisation le
 * parcourt en streaming et n'écrit que le gagnant par matériau, soit au plus
 * autant de lignes que le catalogue en compte.
 *
 * Le prix et le conditionnement stockés sont ceux **du marchand**, tels quels.
 * La mise à l'échelle vers le conditionnement du devis a lieu à la lecture,
 * dans l'adaptateur, parce que le moteur d'estimation choisit ce
 * conditionnement projet par projet.
 */
@Entity('supplier_material_match')
@Index('UQ_supplier_material_match', ['supplier_key', 'material_id'], {
  unique: true,
})
export class SupplierMaterialMatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  supplier_key!: string;

  @Column({ type: 'uuid' })
  material_id!: string;

  /** Identifiant du produit chez le marchand, tel qu'il figure au flux. */
  @Column({ type: 'varchar', length: 100 })
  external_id!: string;

  @Column({ type: 'varchar', length: 500 })
  product_name!: string;

  @Column({ type: 'text' })
  product_url!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  brand!: string | null;

  /** Prix d'un conditionnement marchand, dans la devise du flux. */
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  price!: number;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  /** Quantité contenue dans le conditionnement marchand (2.5 pour un pot de 2,5 L). */
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 4,
    transformer: numericTransformer,
  })
  pack_qty!: number;

  @Column({ type: 'varchar', length: 20 })
  pack_unit!: string;

  @Column({ type: 'varchar', length: 20 })
  availability!: FeedAvailability;

  /** Couverture pondérée obtenue par ce match, conservée pour audit. */
  @Column({
    type: 'numeric',
    precision: 5,
    scale: 4,
    transformer: numericTransformer,
  })
  match_score!: number;

  /**
   * Match corrigé à la main : la synchronisation ne l'écrase jamais. C'est le
   * garde-fou qui permet de rattraper un mauvais rapprochement sans toucher au
   * code ni attendre un réglage du scoring.
   */
  @Column({ type: 'boolean', default: false })
  is_pinned!: boolean;

  @Column({ type: 'timestamptz' })
  matched_at!: Date;

  @ManyToOne(() => MaterialCatalog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'material_id' })
  material!: MaterialCatalog;
}
