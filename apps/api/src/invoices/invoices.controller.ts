import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Response } from 'express';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { FeatureGateGuard } from '../feature-gates/guards/feature-gate.guard';
import { RequireFeature } from '../feature-gates/decorators/require-feature.decorator';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { OrgContextService } from '../organizations/org-context.service';
import type { OrgScope } from '../organizations/org-context.service';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto';
import { InvoiceStatus } from './entities/invoice.entity';

/**
 * Une facture émise est immuable : ni `PATCH` de contenu ni `DELETE` ne sont
 * exposés. Seul l'état de règlement évolue, via `PATCH /:id/status`.
 */
@Controller('invoices')
@UseGuards(FirebaseAuthGuard, FeatureGateGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoicePdfService: InvoicePdfService,
    private readonly orgContext: OrgContextService,
  ) {}

  private resolveScope(firebaseUser: DecodedIdToken): Promise<OrgScope> {
    return this.orgContext.resolveForFirebaseUid(firebaseUser.uid);
  }

  @Post()
  @RequireFeature('invoicing')
  async create(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: CreateInvoiceDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.invoicesService.createFromQuote(
      scope.organizationId,
      scope.userId,
      dto,
    );
  }

  @Get()
  @RequireFeature('invoicing')
  async findAll(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Query('status') status?: InvoiceStatus,
    @Query('quote_id') quoteId?: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.invoicesService.findAllForOrg(scope.organizationId, {
      status,
      quote_id: quoteId,
    });
  }

  @Get(':id')
  @RequireFeature('invoicing')
  async findOne(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.invoicesService.findOneForOrg(id, scope.organizationId);
  }

  @Get(':id/export/pdf')
  @RequireFeature('invoicing')
  async exportPdf(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const scope = await this.resolveScope(firebaseUser);
    const invoice = await this.invoicesService.findOneForOrg(
      id,
      scope.organizationId,
    );

    const buffer = await this.invoicePdfService.generatePdf(invoice);

    const safeName =
      invoice.invoice_number.replace(/[^a-zA-Z0-9-]/g, '') || 'facture';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="facture-${safeName}.pdf"`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Patch(':id/status')
  @RequireFeature('invoicing')
  async updateStatus(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceStatusDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.invoicesService.updateStatus(id, scope.organizationId, dto);
  }
}
