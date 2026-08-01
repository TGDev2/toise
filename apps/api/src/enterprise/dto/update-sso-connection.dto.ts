import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Surface laissée à l'organisation : la **politique**, pas les paramètres de
 * l'IdP. Changer un certificat ou une URL de SSO reste un geste d'administrateur
 * plateforme, parce qu'il transporte des secrets et qu'il peut couper l'accès de
 * toute l'entreprise.
 */
export class UpdateSsoConnectionDto {
  @IsOptional()
  @IsBoolean()
  enforced?: boolean;
}
