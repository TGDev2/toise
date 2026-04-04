import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import type { SupplierPriceResult } from '../adapters/supplier-adapter.interface';

@Entity('supplier_price_cache')
@Index('UQ_supplier_price_cache_lookup', ['supplier_key', 'material_id'], {
  unique: false,
})
export class SupplierPriceCache {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  supplier_key!: string;

  @Column({ type: 'uuid' })
  material_id!: string;

  @Column({ type: 'varchar', length: 255 })
  material_name!: string;

  @Column({ type: 'jsonb' })
  price_data!: SupplierPriceResult;

  @Column({ type: 'varchar', length: 10, nullable: true, default: null })
  postal_code!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  fetched_at!: Date;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;
}
