import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BrevoClientService } from './brevo-client.service';
import { EmailService } from './email.service';

@Module({
  imports: [HttpModule],
  providers: [BrevoClientService, EmailService],
  exports: [EmailService],
})
export class EmailModule {}
