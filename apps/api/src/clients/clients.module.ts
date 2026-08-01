import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgContextModule } from '../organizations/org-context.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { Client } from './entities/client.entity';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client]),
    OrgContextModule,
    FeatureGatesModule,
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
