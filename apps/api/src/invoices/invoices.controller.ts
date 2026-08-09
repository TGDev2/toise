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
import { UserContextService } from '../users/user-context.service';
import type { UserScope } from '../users/user-context.service';
import { InvoicesService } from './invoices.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto';
import { InvoiceStatus } from './entities/invoice.entity';

/**
 * Une facture émise est immuable : ni `PATCH` de contenu ni `DELETE` ne sont
 * exposés. Seul l'état de règlement évolue, via `PATCH /:id/status`.
 *
 * La gate `invoicing` porte sur l'**émission** d'une facture. Consultation,
 * export PDF et mise à jour du règlement restent ouverts (E5-2) : un abonné
 * déclassé ne doit jamais perdre l'accès à sa facturation déjà émise. Le
 * `PATCH /:id/status` est délibérément dans le lot — le gater laisserait une
 * facture encaissée marquée « impayée » pour toujours, donc une comptabilité
 * fausse, ce qui est le même préjudice sous un autre nom.
 */
@Controller('invoices')
@UseGuards(FirebaseAuthGuard, FeatureGateGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly invoicePdfService: InvoicePdfService,
    private readonly userContext: UserContextService,
  ) {}

  private resolveScope(firebaseUser: DecodedIdToken): Promise<UserScope> {
    return this.userContext.resolveForFirebaseUid(firebaseUser.uid);
  }

  @Post()
  @RequireFeature('invoicing')
  async create(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: CreateInvoiceDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.invoicesService.createFromQuote(scope.userId, dto);
  }

  @Get()
  async findAll(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Query('status') status?: InvoiceStatus,
    @Query('quote_id') quoteId?: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.invoicesService.findAllForUser(scope.userId, {
      status,
      quote_id: quoteId,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.invoicesService.findOneForUser(id, scope.userId);
  }

  @Get(':id/export/pdf')
  async exportPdf(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const scope = await this.resolveScope(firebaseUser);
    const invoice = await this.invoicesService.findOneForUser(id, scope.userId);

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
  async updateStatus(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceStatusDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.invoicesService.updateStatus(id, scope.userId, dto);
  }
}
