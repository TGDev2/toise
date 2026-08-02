import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EstimationsService } from './estimations.service';
import { PublicQuoteCheckRequestDto } from './dto/public-quote-check-request.dto';

/**
 * Contrôle de cohérence d'un devis reçu (GTM-10) — surface publique, sans compte,
 * qui alimente la page /verifier-un-devis.
 *
 * Rien n'est écrit : ni projet, ni capture, ni trace nominative. Le plafond est
 * celui de `/public/calculators/estimate` (calcul non authentifié, sans écriture),
 * et non celui, plus serré, de `estimate-email` qui, lui, écrit en base.
 */
@Controller('public/quote-check')
export class PublicQuoteCheckController {
  constructor(private readonly estimationsService: EstimationsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  check(@Body() dto: PublicQuoteCheckRequestDto) {
    return this.estimationsService.checkQuotePublic(dto);
  }
}
