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
  NotFoundException,
  Res,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Response } from 'express';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { FeatureGateGuard } from '../feature-gates/guards/feature-gate.guard';
import { RequireFeature } from '../feature-gates/decorators/require-feature.decorator';
import { CurrentFirebaseUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
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
    private readonly usersService: UsersService,
  ) {}

  private async resolveUserId(firebaseUser: DecodedIdToken): Promise<string> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) throw new NotFoundException('User not found');
    return user.id;
  }

  @Post()
  @RequireFeature('invoicing')
  async create(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: CreateInvoiceDto,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    return this.invoicesService.createFromQuote(userId, dto);
  }

  @Get()
  @RequireFeature('invoicing')
  async findAll(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Query('status') status?: InvoiceStatus,
    @Query('quote_id') quoteId?: string,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    return this.invoicesService.findAllByUser(userId, {
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
    const userId = await this.resolveUserId(firebaseUser);
    return this.invoicesService.findOneByUser(id, userId);
  }

  @Get(':id/export/pdf')
  @RequireFeature('invoicing')
  async exportPdf(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const userId = await this.resolveUserId(firebaseUser);
    const invoice = await this.invoicesService.findOneByUser(id, userId);

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
    const userId = await this.resolveUserId(firebaseUser);
    return this.invoicesService.updateStatus(id, userId, dto);
  }
}
