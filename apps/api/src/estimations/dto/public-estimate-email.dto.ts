import { IsBoolean, IsEmail, MaxLength } from 'class-validator';
import { PublicEstimateRequestDto } from './public-estimate-request.dto';

export class PublicEstimateEmailDto extends PublicEstimateRequestDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsBoolean()
  consent!: boolean;
}
