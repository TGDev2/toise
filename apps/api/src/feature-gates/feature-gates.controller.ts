import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { FeatureGatesService } from './feature-gates.service';
import { UpsertFeatureGateDto } from './dto/upsert-feature-gate.dto';

@Controller()
export class FeatureGatesController {
  constructor(private readonly featureGatesService: FeatureGatesService) {}

  @Get('feature-gates')
  @UseGuards(FirebaseAuthGuard)
  async getAllGates() {
    const gates = await this.featureGatesService.getAllGates();
    return gates.map((g) => ({
      feature_key: g.feature_key,
      label_fr: g.label_fr,
      description_fr: g.description_fr,
      min_tier: g.min_tier,
      is_enabled: g.is_enabled,
    }));
  }

  @Get('admin/feature-gates')
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  async adminGetAll() {
    return this.featureGatesService.getAllGates();
  }

  @Put('admin/feature-gates/:key')
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  async adminUpsert(
    @Param('key') key: string,
    @Body() dto: UpsertFeatureGateDto,
  ) {
    return this.featureGatesService.upsertGate(key, dto);
  }

  @Delete('admin/feature-gates/:key')
  @UseGuards(FirebaseAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async adminDelete(@Param('key') key: string) {
    await this.featureGatesService.deleteGate(key);
  }
}
