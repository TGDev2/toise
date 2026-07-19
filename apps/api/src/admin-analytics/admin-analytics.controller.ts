import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminAnalyticsService } from './admin-analytics.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Controller('admin/analytics')
@UseGuards(FirebaseAuthGuard, AdminGuard)
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @Get('dashboard')
  async getDashboard(@Query() query: DashboardQueryDto) {
    return this.adminAnalyticsService.getDashboard(
      query.weeks ?? 8,
      query.days ?? 30,
    );
  }
}
