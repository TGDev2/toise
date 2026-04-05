import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { ShoppingListsModule } from '../shopping-lists/shopping-lists.module';
import { CompanyProfilesModule } from '../company-profiles/company-profiles.module';
import { ClientsModule } from '../clients/clients.module';
import { ProjectsModule } from '../projects/projects.module';
import { Quote } from './entities/quote.entity';
import { EstimationResult } from '../estimations/entities/estimation-result.entity';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';
import { QuotePdfService } from './quote-pdf.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote, EstimationResult]),
    UsersModule,
    FeatureGatesModule,
    ShoppingListsModule,
    CompanyProfilesModule,
    ClientsModule,
    ProjectsModule,
  ],
  controllers: [QuotesController],
  providers: [QuotesService, QuotePdfService],
  exports: [QuotesService],
})
export class QuotesModule {}
