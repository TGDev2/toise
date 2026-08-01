import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  ValidateIf,
} from 'class-validator';
import { OrganizationRole } from '../../organizations/entities/organization-membership.entity';
import { SsoProtocol } from '../entities/sso-connection.entity';

/**
 * Les champs d'IdP de ce DTO **ne sont pas persistés** : ils traversent le
 * provisionneur vers GCIP puis sont oubliés (PLAT-6 D5). C'est aussi pourquoi
 * cet endpoint est réservé aux administrateurs plateforme : il transporte le
 * certificat ou le `client_secret` du client.
 */
export class CreateSsoConnectionDto {
  @IsUUID()
  organization_id!: string;

  @IsEnum(SsoProtocol)
  protocol!: SsoProtocol;

  @IsString()
  @Length(1, 100)
  display_name!: string;

  /** `owner` est exclu : la propriété se transfère, elle ne se provisionne pas. */
  @IsOptional()
  @IsIn([OrganizationRole.ADMIN, OrganizationRole.MEMBER])
  default_role?: OrganizationRole.ADMIN | OrganizationRole.MEMBER;

  // ── SAML ────────────────────────────────────────────────────────────────
  @ValidateIf(
    (dto: CreateSsoConnectionDto) => dto.protocol === SsoProtocol.SAML,
  )
  @IsString()
  @Length(1, 1024)
  idp_entity_id?: string;

  @ValidateIf(
    (dto: CreateSsoConnectionDto) => dto.protocol === SsoProtocol.SAML,
  )
  @IsUrl({ protocols: ['https'], require_protocol: true })
  sso_url?: string;

  @ValidateIf(
    (dto: CreateSsoConnectionDto) => dto.protocol === SsoProtocol.SAML,
  )
  @IsString()
  @Length(1, 8192)
  x509_certificate?: string;

  // ── OIDC ────────────────────────────────────────────────────────────────
  @ValidateIf(
    (dto: CreateSsoConnectionDto) => dto.protocol === SsoProtocol.OIDC,
  )
  @IsUrl({ protocols: ['https'], require_protocol: true })
  issuer?: string;

  @ValidateIf(
    (dto: CreateSsoConnectionDto) => dto.protocol === SsoProtocol.OIDC,
  )
  @IsString()
  @Length(1, 512)
  client_id?: string;

  @ValidateIf(
    (dto: CreateSsoConnectionDto) => dto.protocol === SsoProtocol.OIDC,
  )
  @IsString()
  @Length(1, 512)
  client_secret?: string;
}
