import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
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
import { CompanyProfilesService } from '../company-profiles/company-profiles.service';
import { ClientsService } from '../clients/clients.service';
import { QuotesService } from './quotes.service';
import { QuotePdfService } from './quote-pdf.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { UpdateQuoteStatusDto } from './dto/update-quote-status.dto';
import { QuoteStatus } from './entities/quote.entity';

@Controller('quotes')
@UseGuards(FirebaseAuthGuard, FeatureGateGuard)
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly quotePdfService: QuotePdfService,
    private readonly usersService: UsersService,
    private readonly companyProfilesService: CompanyProfilesService,
    private readonly clientsService: ClientsService,
  ) {}

  private async resolveUserId(firebaseUser: DecodedIdToken): Promise<string> {
    const user = await this.usersService.findByFirebaseUid(firebaseUser.uid);
    if (!user) throw new NotFoundException('User not found');
    return user.id;
  }

  @Post()
  @RequireFeature('export_devis')
  async create(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: CreateQuoteDto,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    return this.quotesService.create(userId, dto);
  }

  @Get()
  @RequireFeature('export_devis')
  async findAll(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Query('status') status?: QuoteStatus,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    return this.quotesService.findAllByUser(userId, status);
  }

  @Get(':id')
  @RequireFeature('export_devis')
  async findOne(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    return this.quotesService.findOneByUser(id, userId);
  }

  @Patch(':id')
  @RequireFeature('export_devis')
  async update(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteDto,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    return this.quotesService.update(id, userId, dto);
  }

  @Patch(':id/status')
  @RequireFeature('export_devis')
  async updateStatus(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteStatusDto,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    return this.quotesService.updateStatus(id, userId, dto.status);
  }

  @Get(':id/export/pdf')
  @RequireFeature('export_devis')
  async exportPdf(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const userId = await this.resolveUserId(firebaseUser);
    const quote = await this.quotesService.findOneByUser(id, userId);

    const companyProfile =
      await this.companyProfilesService.findByUserId(userId);
    if (!companyProfile) {
      throw new NotFoundException(
        'Profil entreprise requis pour generer un devis PDF',
      );
    }

    let client = null;
    if (quote.client_id) {
      client = await this.clientsService.findOneByUser(
        quote.client_id,
        userId,
      );
    }

    const buffer = await this.quotePdfService.generatePdf(
      quote,
      companyProfile,
      client,
    );

    const safeName =
      quote.quote_number.replace(/[^a-zA-Z0-9-]/g, '') || 'devis';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="devis-${safeName}.pdf"`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  @Delete(':id')
  @RequireFeature('export_devis')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const userId = await this.resolveUserId(firebaseUser);
    await this.quotesService.remove(id, userId);
  }
}
