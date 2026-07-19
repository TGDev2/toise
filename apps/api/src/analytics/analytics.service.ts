import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { AnalyticsEventName } from './analytics-event-name.enum';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly eventsRepo: Repository<AnalyticsEvent>,
  ) {}

  track(
    eventName: AnalyticsEventName,
    userId: string | null,
    properties: Record<string, unknown> = {},
  ): void {
    const event = this.eventsRepo.create({
      user_id: userId,
      event_name: eventName,
      properties,
    });
    // Fire-and-forget: don't block the request
    this.eventsRepo.save(event).catch(() => {});
  }
}
