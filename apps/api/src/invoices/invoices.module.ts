import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesController } from './invoices.controller';
import { OrgContextModule } from '../organizations/org-context.module';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { QuotesModule } from '../quotes/quotes.module';
import { CompanyProfilesModule } from '../company-profiles/company-profiles.module';
import { ClientsModule } from '../clients/clients.module';

/**
 * Dépendance à sens unique invoices → quotes : c'est la raison pour laquelle la
 * conversion est exposée en `POST /invoices { quote_id }` et non en
 * `POST /quotes/:id/invoice`, qui imposerait un `forwardRef` entre les deux
 * modules.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice]),
    OrgContextModule,
    FeatureGatesModule,
    QuotesModule,
    CompanyProfilesModule,
    ClientsModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicePdfService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
