import { IsString, Length } from 'class-validator';

export class CreateApiKeyDto {
  /** Une clé anonyme est ingérable : on ne saurait plus laquelle révoquer. */
  @IsString()
  @Length(1, 100)
  name!: string;
}
