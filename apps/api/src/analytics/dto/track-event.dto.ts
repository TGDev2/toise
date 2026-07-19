import { IsEnum, IsOptional, IsObject } from 'class-validator';
import { AnalyticsEventName } from '../analytics-event-name.enum';

export class TrackEventDto {
  @IsEnum(AnalyticsEventName)
  event_name!: AnalyticsEventName;

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}
