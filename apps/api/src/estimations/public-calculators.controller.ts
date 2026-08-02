import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EstimationsService } from './estimations.service';
import { PublicEstimateRequestDto } from './dto/public-estimate-request.dto';
import { PublicEstimateEmailDto } from './dto/public-estimate-email.dto';

// Public endpoint (no auth guard) powering the /calculateurs lead-magnet pages.
@Controller('public/calculators')
export class PublicCalculatorsController {
  constructor(private readonly estimationsService: EstimationsService) {}

  @Post('estimate')
  @HttpCode(HttpStatus.OK)
  // Plus strict que le plafond global (100/min) : calcul non authentifié.
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  estimate(@Body() dto: PublicEstimateRequestDto) {
    return this.estimationsService.estimatePublic(dto);
  }

  @Post('estimate-email')
  @HttpCode(HttpStatus.OK)
  // Tighter than /estimate: this writes to the DB and mails an arbitrary
  // third-party address. Mirrors auth.controller's forgot-password limit
  // rather than the 20/min compute-only rate.
  @Throttle({ default: { ttl: 3600000, limit: 3 } })
  emailEstimate(@Body() dto: PublicEstimateEmailDto) {
    return this.estimationsService.emailEstimate(dto);
  }
}
