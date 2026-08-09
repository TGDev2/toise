import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Demande d'exercice du « 30 jours satisfait ou remboursé » (E3-3).
 *
 * Le motif est facultatif et libre. Il n'est ni classé ni exigé : réclamer une
 * raison avant de rendre l'argent transforme une garantie en négociation, ce
 * qui est exactement ce que la promesse dit ne pas faire. Il est en revanche
 * conservé dans la trace, parce que l'ADR 0002 §5.1 se sert du remboursement
 * comme d'un signal sur la qualité de la promesse — et un signal sans motif ne
 * dit pas quoi corriger.
 */
export class RequestRefundDto {
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'Le motif ne peut pas dépasser 500 caractères.',
  })
  reason?: string;
}
