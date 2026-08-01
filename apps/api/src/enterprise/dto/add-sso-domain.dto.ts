import { IsString, Length } from 'class-validator';

export class AddSsoDomainDto {
  /** Normalisé et contrôlé par le service (cf. `normalizeDomain`). */
  @IsString()
  @Length(1, 255)
  domain!: string;
}
