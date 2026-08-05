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
import { OrgContextService } from '../organizations/org-context.service';
import type { OrgScope } from '../organizations/org-context.service';
import { CompanyProfilesService } from '../company-profiles/company-profiles.service';
import { ClientsService } from '../clients/clients.service';
import { QuotesService } from './quotes.service';
import { QuotePdfService } from './quote-pdf.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { UpdateQuoteStatusDto } from './dto/update-quote-status.dto';
import { QuoteStatus } from './entities/quote.entity';

/**
 * La gate `export_devis` porte sur la **production** d'un devis, pas sur sa
 * consultation. Lire la liste, ouvrir un devis et le réexporter en PDF restent
 * donc ouverts (E5-2) : un abonné déclassé — impayé non régularisé, ou
 * résiliation — ne doit jamais perdre l'accès aux devis qu'il a déjà émis. Ce
 * sont des documents commerciaux engageants, parfois opposables ; les rendre
 * inatteignables pour cause de facturation serait une confiscation, et le
 * bandeau de relance qui promet le contraire deviendrait un mensonge.
 *
 * Le périmètre reste scopé par `FirebaseAuthGuard` et `scope.organizationId` :
 * ouvrir la lecture n'ouvre rien à qui n'a rien produit — un utilisateur jamais
 * abonné a une liste vide.
 */
@Controller('quotes')
@UseGuards(FirebaseAuthGuard, FeatureGateGuard)
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly quotePdfService: QuotePdfService,
    private readonly orgContext: OrgContextService,
    private readonly companyProfilesService: CompanyProfilesService,
    private readonly clientsService: ClientsService,
  ) {}

  private resolveScope(firebaseUser: DecodedIdToken): Promise<OrgScope> {
    return this.orgContext.resolveForFirebaseUid(firebaseUser.uid);
  }

  @Post()
  @RequireFeature('export_devis')
  async create(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Body() dto: CreateQuoteDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.quotesService.create(scope.organizationId, scope.userId, dto);
  }

  // Déclarée avant `@Get(':id')` : sinon `ParseUUIDPipe` sur `:id` avale
  // `labor-proposal` et le rend inatteignable.
  @Get('labor-proposal')
  @RequireFeature('export_devis')
  async laborProposal(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Query('project_id', ParseUUIDPipe) projectId: string,
    @Query('estimation_id', ParseUUIDPipe) estimationId: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.quotesService.proposeLaborLines(
      scope.organizationId,
      projectId,
      estimationId,
    );
  }

  @Get()
  async findAll(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Query('status') status?: QuoteStatus,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.quotesService.findAllForOrg(scope.organizationId, status);
  }

  @Get(':id')
  async findOne(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.quotesService.findOneForOrg(id, scope.organizationId);
  }

  @Patch(':id')
  @RequireFeature('export_devis')
  async update(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.quotesService.update(id, scope.organizationId, dto);
  }

  @Patch(':id/status')
  @RequireFeature('export_devis')
  async updateStatus(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteStatusDto,
  ) {
    const scope = await this.resolveScope(firebaseUser);
    return this.quotesService.updateStatus(
      id,
      scope.organizationId,
      dto.status,
    );
  }

  // Non gaté : le devis existe déjà, le PDF n'en est qu'une vue. Le refuser
  // reviendrait à retenir en otage un document dont le client final a besoin.
  @Get(':id/export/pdf')
  async exportPdf(
    @CurrentFirebaseUser() firebaseUser: DecodedIdToken,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const scope = await this.resolveScope(firebaseUser);
    const quote = await this.quotesService.findOneForOrg(
      id,
      scope.organizationId,
    );

    const companyProfile =
      await this.companyProfilesService.findByOrganizationId(
        scope.organizationId,
      );
    if (!companyProfile) {
      throw new NotFoundException(
        'Profil entreprise requis pour generer un devis PDF',
      );
    }

    let client = null;
    if (quote.client_id) {
      client = await this.clientsService.findOneForOrg(
        quote.client_id,
        scope.organizationId,
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
    const scope = await this.resolveScope(firebaseUser);
    await this.quotesService.remove(id, scope.organizationId);
  }
}
