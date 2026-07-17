import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EstimationsService } from './estimations.service';
import { PublicEstimateRequestDto } from './dto/public-estimate-request.dto';

// Public endpoint (no auth guard) powering the /calculateurs lead-magnet pages.
@Controller('public/calculators')
export class PublicCalculatorsController {
  constructor(private readonly estimationsService: EstimationsService) {}

  @Post('estimate')
  @HttpCode(HttpStatus.OK)
  // Override both named throttlers: the global 'auth' default (5 req/15 min)
  // would otherwise cap this public endpoint.
  @Throttle({
    short: { ttl: 60000, limit: 20 },
    auth: { ttl: 60000, limit: 20 },
  })
  estimate(@Body() dto: PublicEstimateRequestDto) {
    return this.estimationsService.estimatePublic(dto);
  }
}
