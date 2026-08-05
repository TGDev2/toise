import { IsNotEmpty, IsString } from 'class-validator';

export class MergeGuestDto {
  /**
   * Le **jeton d'identité** du compte invité, pas son UID.
   *
   * Un UID est un identifiant public : le fournir suffisait à désigner
   * n'importe quel compte anonyme, dont les projets partaient vers l'appelant
   * et dont le compte était ensuite supprimé (E6-3). Un jeton, lui, ne
   * s'obtient qu'en ayant réellement ouvert la session invité — c'est la
   * preuve de possession, et l'UID en est dérivé côté serveur.
   *
   * Le champ a changé de nom volontairement : `whitelist` +
   * `forbidNonWhitelisted` font répondre 400 à un client resté sur l'ancien
   * format, là où un simple ajout l'aurait laissé fusionner sans preuve.
   */
  @IsString()
  @IsNotEmpty()
  anonymous_id_token!: string;
}
