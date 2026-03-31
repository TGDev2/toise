import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { FeatureGate } from './entities/feature-gate.entity';
import { FeatureGatesService } from './feature-gates.service';
import { FeatureGatesController } from './feature-gates.controller';
import { FeatureGateGuard } from './guards/feature-gate.guard';

@Module({
  imports: [TypeOrmModule.forFeature([FeatureGate]), UsersModule],
  controllers: [FeatureGatesController],
  providers: [FeatureGatesService, FeatureGateGuard],
  exports: [FeatureGatesService, FeatureGateGuard],
})
export class FeatureGatesModule {}
