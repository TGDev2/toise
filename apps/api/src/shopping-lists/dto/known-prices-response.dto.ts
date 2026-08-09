/**
 * E4-4 — dernier prix relevé par le compte pour un article donné.
 *
 * `recorded_on` accompagne toujours le prix : un tarif de peinture de l'an
 * dernier ne se reprend pas les yeux fermés, et l'artisan doit pouvoir en
 * juger avant de l'appliquer.
 */
export interface KnownPriceDto {
  /** `material_id` pour un matériau, `complementary_material_id` pour un complément. */
  item_id: string;
  real_unit_price: number;
  store_name: string | null;
  /** Date de dernière écriture de la liste d'où vient le prix (`yyyy-mm-dd`). */
  recorded_on: string;
  /** Chantier d'origine, pour que le rappel soit traçable à l'écran. */
  project_name: string;
}

export class KnownPricesResponseDto {
  materials!: KnownPriceDto[];
  complements!: KnownPriceDto[];

  static fromResult(result: {
    materials: KnownPriceDto[];
    complements: KnownPriceDto[];
  }): KnownPricesResponseDto {
    const dto = new KnownPricesResponseDto();
    dto.materials = result.materials;
    dto.complements = result.complements;
    return dto;
  }
}
