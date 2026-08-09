import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../photos/storage/storage.module';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { DataExportRequest } from './entities/data-export-request.entity';
import { User } from '../users/entities/user.entity';
import { Client } from '../clients/entities/client.entity';
import { CompanyProfile } from '../company-profiles/entities/company-profile.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectWorkItem } from '../projects/entities/project-work-item.entity';
import { ProjectPhoto } from '../photos/entities/project-photo.entity';
import { EstimationResult } from '../estimations/entities/estimation-result.entity';
import { ShoppingList } from '../shopping-lists/entities/shopping-list.entity';
import { AnalysisJob } from '../analysis/entities/analysis-job.entity';
import { CvCorrectionLog } from '../analysis/entities/cv-correction-log.entity';
import { SiteMilestone } from '../site-tracking/entities/site-milestone.entity';
import { Quote } from '../quotes/entities/quote.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { CommunityProject } from '../community/entities/community-project.entity';
import { CommunityLike } from '../community/entities/community-like.entity';
import { CommunityComment } from '../community/entities/community-comment.entity';
import { ReferralCredit } from '../referrals/entities/referral-credit.entity';
import { RoomLogEntry } from '../logbook/entities/room-log-entry.entity';
import { LifecycleEmailSend } from '../lifecycle-emails/entities/lifecycle-email-send.entity';
import { AnalyticsEvent } from '../analytics/entities/analytics-event.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionRefund } from '../subscriptions/entities/subscription-refund.entity';
import { QuantityValidation } from '../quantity-validation/entities/quantity-validation.entity';
import { QuantityCorrection } from '../quantity-validation/entities/quantity-correction.entity';
import { DataExportService } from './data-export.service';
import { DataExportController } from './data-export.controller';
import { QuotePdfService } from '../quotes/quote-pdf.service';
import { InvoicePdfService } from '../invoices/invoice-pdf.service';

/**
 * `QuotePdfService`/`InvoicePdfService` sont fournis directement ici plutôt
 * qu'importés via `QuotesModule`/`InvoicesModule` : ce sont des classes sans
 * dépendance (rendu PDFKit pur), et ces deux modules n'exportent que leur
 * service métier — les y ajouter à l'export public pour ce seul usage aurait
 * élargi leur surface pour tous leurs autres consommateurs.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DataExportRequest,
      User,
      Client,
      CompanyProfile,
      Project,
      ProjectWorkItem,
      ProjectPhoto,
      EstimationResult,
      ShoppingList,
      AnalysisJob,
      CvCorrectionLog,
      SiteMilestone,
      Quote,
      Invoice,
      CommunityProject,
      CommunityLike,
      CommunityComment,
      ReferralCredit,
      RoomLogEntry,
      LifecycleEmailSend,
      AnalyticsEvent,
      Subscription,
      SubscriptionRefund,
      QuantityValidation,
      QuantityCorrection,
    ]),
    StorageModule,
    UsersModule,
    SubscriptionsModule,
  ],
  controllers: [DataExportController],
  providers: [DataExportService, QuotePdfService, InvoicePdfService],
  exports: [DataExportService],
})
export class DataExportModule {}
