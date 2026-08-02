import { IsNumber, Max, Min } from 'class-validator';
import { PublicEstimateRequestDto } from './public-estimate-request.dto';

/**
 * Contrôle de cohérence d'un devis reçu (GTM-10).
 *
 * Hérite volontairement de `PublicEstimateRequestDto` : la pièce est décrite une
 * seule fois. Recopier les champs ici créerait la deuxième description qui, tôt ou
 * tard, ne recevrait pas le champ ajouté à l'autre — c'est exactement ainsi que
 * `exclusions` avait manqué au chemin public avant GTM-9, laissant l'écran déduire
 * une surface que le moteur rachetait.
 *
 * Un seul champ propre : la quantité que **porte le devis** pour cet ouvrage, dans
 * l'unité de la surface (m²). C'est ce que les devis d'artisan français affichent
 * réellement ; le détail matériaux est le plus souvent noyé dans un forfait
 * « fourniture ».
 */
export class PublicQuoteCheckRequestDto extends PublicEstimateRequestDto {
  /**
   * Quantité facturée par le devis, en m².
   *
   * Borne basse à 0,1 m² : en deçà, la ligne n'est pas une surface d'ouvrage et le
   * taux de perte impliqué exploserait sur une valeur saisie de travers. Borne
   * haute alignée sur `PublicExclusionDto.area_m2` (500 m²) puis élargie à 2000 m²
   * — un devis peut couvrir plusieurs pièces là où une exclusion vise une zone.
   */
  @IsNumber()
  @Min(0.1)
  @Max(2000)
  declared_surface_m2!: number;
}
