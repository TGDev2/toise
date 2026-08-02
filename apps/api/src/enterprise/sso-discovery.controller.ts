import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SsoConnectionsService } from './sso-connections.service';
import { domainOfEmail } from './public-email-domains';

/**
 * Découverte « adresse e-mail → fournisseur d'identité » (BACKLOG PLAT-6 D13).
 *
 * Sans authentification, par construction : c'est la première étape d'un flux
 * SP-initiated, avant que quiconque ne soit connecté. La réponse est donc
 * réduite au strict nécessaire pour lancer la redirection — ni nom
 * d'organisation, ni état de contrat, ni existence d'un compte.
 *
 * La contrepartie assumée : cette route révèle qu'un domaine est client. Elle est
 * inhérente au flux (l'utilisateur doit être routé vers son IdP avant toute
 * authentification) et bornée par un `@Throttle` explicite plus strict que le
 * plafond global (100/min) : c'est un oracle d'existence de domaine, on ne
 * l'énumère pas à 100 requêtes par minute.
 */
@Controller('sso')
@Throttle({ default: { ttl: 60000, limit: 20 } })
export class SsoDiscoveryController {
  constructor(private readonly ssoConnectionsService: SsoConnectionsService) {}

  @Get('discover')
  async discover(@Query('email') email?: string) {
    if (typeof email !== 'string' || email.length === 0) {
      throw new BadRequestException('Adresse e-mail requise');
    }

    const domain = domainOfEmail(email);
    if (!domain) {
      throw new BadRequestException('Adresse e-mail invalide');
    }

    const connection =
      await this.ssoConnectionsService.discoverByDomain(domain);
    if (!connection) {
      // Même réponse qu'un domaine inconnu : un 404 ne dit rien de plus que
      // « pas de SSO ici », et le parcours retombe sur le mot de passe.
      throw new NotFoundException('Aucune connexion SSO pour ce domaine');
    }

    return connection;
  }
}
