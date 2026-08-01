import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { MaterialsModule } from './materials/materials.module';
import { EstimationsModule } from './estimations/estimations.module';
import { ShoppingListsModule } from './shopping-lists/shopping-lists.module';
import { PhotosModule } from './photos/photos.module';
import { AnalysisModule } from './analysis/analysis.module';
import { FeatureGatesModule } from './feature-gates/feature-gates.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdminAnalyticsModule } from './admin-analytics/admin-analytics.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PriceComparisonModule } from './price-comparison/price-comparison.module';
import { CompanyProfilesModule } from './company-profiles/company-profiles.module';
import { ClientsModule } from './clients/clients.module';
import { QuotesModule } from './quotes/quotes.module';
import { SiteTrackingModule } from './site-tracking/site-tracking.module';
import { QuoteRemindersModule } from './quote-reminders/quote-reminders.module';
import { InvoicesModule } from './invoices/invoices.module';
import { CommunityModule } from './community/community.module';
import { ReferralsModule } from './referrals/referrals.module';
import { LogbookModule } from './logbook/logbook.module';
import configuration from './config/configuration';
import { validate } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.name'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60000, limit: 100 },
      { name: 'auth', ttl: 900000, limit: 5 },
    ]),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    ProjectsModule,
    MaterialsModule,
    EstimationsModule,
    ShoppingListsModule,
    PhotosModule,
    AnalysisModule,
    FeatureGatesModule,
    AnalyticsModule,
    AdminAnalyticsModule,
    SubscriptionsModule,
    PriceComparisonModule,
    CompanyProfilesModule,
    ClientsModule,
    QuotesModule,
    SiteTrackingModule,
    QuoteRemindersModule,
    InvoicesModule,
    CommunityModule,
    ReferralsModule,
    LogbookModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
