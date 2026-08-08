import { IsString, Matches } from 'class-validator';

export class ValidateQuantitiesDto {
  /**
   * L'empreinte que l'écran **affichait** au moment du geste.
   *
   * Le serveur ne s'en sert pas pour écrire — il recalcule la sienne depuis la
   * liste courante — mais pour refuser la validation quand les deux diffèrent.
   * Sans ce champ, un artisan validerait ce que le serveur a sous la main, qui
   * n'est pas nécessairement ce qu'il a lu : une liste régénérée dans un autre
   * onglet suffit à les séparer, et la trace attesterait alors d'un
   * consentement qui n'a pas eu lieu.
   */
  @IsString()
  @Matches(/^[0-9a-f]{64}$/, {
    message: 'Empreinte de quantités invalide.',
  })
  fingerprint!: string;
}
