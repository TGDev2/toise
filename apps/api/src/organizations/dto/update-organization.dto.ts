import { IsString, Length } from 'class-validator';

export class UpdateOrganizationDto {
  @IsString()
  @Length(1, 255)
  name!: string;
}
