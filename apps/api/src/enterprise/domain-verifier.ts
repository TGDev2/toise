import { Injectable, Logger } from '@nestjs/common';
import { resolveTxt } from 'dns/promises';

/** Préfixe attendu dans l'enregistrement TXT du domaine à prouver. */
export const DOMAIN_VERIFICATION_PREFIX = 'chiffreo-verification=';

/**
 * Preuve de possession d'un domaine par enregistrement TXT (PLAT-6 D4).
 *
 * Isolé dans sa propre classe pour deux raisons : c'est le seul appel réseau
 * sortant de ce module, et un test ne doit évidemment pas dépendre du DNS
 * public.
 */
@Injectable()
export class DomainVerifier {
  private readonly logger = new Logger(DomainVerifier.name);

  /**
   * Le TXT est cherché sur le domaine **et** sur `_chiffreo.<domaine>` : la
   * seconde forme évite de polluer la zone apex, où certains hébergeurs
   * n'acceptent qu'un seul TXT (conflit fréquent avec SPF).
   *
   * Toute erreur de résolution (`NXDOMAIN`, timeout, zone sans TXT) vaut « non
   * prouvé » : la vérification est un test de possession, pas un diagnostic DNS.
   */
  async hasVerificationRecord(domain: string, token: string): Promise<boolean> {
    const expected = `${DOMAIN_VERIFICATION_PREFIX}${token}`;
    const candidates = [`_chiffreo.${domain}`, domain];

    for (const name of candidates) {
      const records = await this.safeResolveTxt(name);
      // `resolveTxt` rend des fragments : un TXT long est découpé par le
      // résolveur et doit être recollé avant comparaison.
      if (records.some((chunks) => chunks.join('').trim() === expected)) {
        return true;
      }
    }
    return false;
  }

  private async safeResolveTxt(name: string): Promise<string[][]> {
    try {
      return await resolveTxt(name);
    } catch (error) {
      this.logger.debug(
        `Résolution TXT sans réponse pour ${name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }
}
