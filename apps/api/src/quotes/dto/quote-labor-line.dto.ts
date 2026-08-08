import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Une ligne de MO envoyée par le client (E2-3). `work_item_id` est une chaîne
 * opaque, jamais un UUID garanti (le moteur d'estimation émet `'public'` ou
 * `` `${roomId}:${workTypeCode}` `` sur les parcours public/widget) : jamais
 * de `@IsUUID()` ici.
 *
 * `line_total_ht` est accepté puis **toujours ignoré** : la réponse de
 * `GET /quotes/labor-proposal` le renvoie déjà, et un client qui soumet le
 * tableau tel qu'il l'a reçu ne doit pas essuyer un 400
 * `forbidNonWhitelisted`. Le serveur recalcule systématiquement
 * `round2(quantity × unit_price_ht)`.
 */
export class QuoteLaborLineDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  work_item_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  work_type_code?: string | null;

  @IsString()
  @MaxLength(255)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  room_name?: string | null;

  @IsIn(['hourly', 'flat'])
  kind!: 'hourly' | 'flat';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100000)
  surface_m2?: number | null;

  @IsNumber()
  @Min(0)
  @Max(100000)
  quantity!: number;

  @IsNumber()
  @Min(0)
  @Max(1000000)
  unit_price_ht!: number;

  @IsOptional()
  @IsNumber()
  line_total_ht?: number;

  /**
   * E2-2 — même statut que `line_total_ht` : la proposition la renvoie pour
   * que l'écran puisse dire d'où sort le nombre d'heures, et le client la
   * resoumet telle quelle. Acceptée pour ne pas essuyer un 400
   * `forbidNonWhitelisted`, **jamais lue** : la source du temps n'est pas
   * persistée sur le devis (cf. `QuoteLaborBasis`, `entities/quote.entity.ts`).
   * Non validée dans le détail — rien ne la lit, il n'y a donc rien à garantir.
   */
  @IsOptional()
  @IsObject()
  basis?: unknown;
}
