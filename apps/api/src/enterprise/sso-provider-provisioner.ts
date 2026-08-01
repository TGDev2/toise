import { Injectable, Logger } from '@nestjs/common';
import { FirebaseConfig } from '../config/firebase.config';
import { SsoProtocol } from './entities/sso-connection.entity';

/**
 * Paramètres de l'IdP tels que le client les fournit. **Ils ne sont jamais
 * persistés** : ils traversent ce provisionneur vers GCIP puis sont oubliés
 * (PLAT-6 D5).
 */
export interface SamlProviderSettings {
  idp_entity_id: string;
  sso_url: string;
  x509_certificate: string;
  rp_entity_id: string;
  callback_url: string;
}

export interface OidcProviderSettings {
  issuer: string;
  client_id: string;
  client_secret: string;
}

export type SsoProviderSettings = SamlProviderSettings | OidcProviderSettings;

/**
 * Création et suppression des fournisseurs d'identité chez Google Cloud Identity
 * Platform (l'upgrade payant de Firebase Auth), via le SDK Admin.
 *
 * Isolé dans sa propre classe parce que c'est le seul effet de bord externe du
 * module : il doit être remplaçable en test, et son échec doit rester lisible.
 * `createProviderConfig` exige que le projet Firebase soit passé sous Identity
 * Platform — sans quoi l'appel échoue, la connexion reste `failed` et le motif
 * est rendu à l'administrateur plutôt qu'avalé.
 */
@Injectable()
export class SsoProviderProvisioner {
  private readonly logger = new Logger(SsoProviderProvisioner.name);

  constructor(private readonly firebase: FirebaseConfig) {}

  async create(
    providerId: string,
    protocol: SsoProtocol,
    displayName: string,
    settings: SsoProviderSettings,
  ): Promise<void> {
    const auth = this.firebase.getAuth();

    if (protocol === SsoProtocol.SAML) {
      const saml = settings as SamlProviderSettings;
      await auth.createProviderConfig({
        providerId,
        displayName,
        enabled: true,
        idpEntityId: saml.idp_entity_id,
        ssoURL: saml.sso_url,
        x509Certificates: [saml.x509_certificate],
        rpEntityId: saml.rp_entity_id,
        callbackURL: saml.callback_url,
      });
    } else {
      const oidc = settings as OidcProviderSettings;
      await auth.createProviderConfig({
        providerId,
        displayName,
        enabled: true,
        issuer: oidc.issuer,
        clientId: oidc.client_id,
        clientSecret: oidc.client_secret,
        responseType: { code: true },
      });
    }

    this.logger.log(`Fournisseur d'identité ${providerId} créé chez GCIP`);
  }

  /**
   * Appelée **avant** la suppression de la ligne : si GCIP refuse, la ligne est
   * conservée et l'erreur remonte, plutôt que de perdre la trace d'un
   * fournisseur encore vivant (PLAT-6 D12).
   */
  async delete(providerId: string): Promise<void> {
    await this.firebase.getAuth().deleteProviderConfig(providerId);
    this.logger.log(`Fournisseur d'identité ${providerId} supprimé chez GCIP`);
  }
}
