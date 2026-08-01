import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quote } from '../quotes/entities/quote.entity';
import { FeatureGatesModule } from '../feature-gates/feature-gates.module';
import { CompanyProfilesModule } from '../company-profiles/company-profiles.module';
import { EmailModule } from '../email/email.module';
import { QuoteRemindersService } from './quote-reminders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote]),
    FeatureGatesModule,
    CompanyProfilesModule,
    EmailModule,
  ],
  providers: [QuoteRemindersService],
})
export class QuoteRemindersModule {}
