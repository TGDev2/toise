import { IsIn, IsObject, IsOptional } from 'class-validator';
import { AnalyticsEventName } from '../analytics-event-name.enum';

// Allow-list volontairement restreinte : un appelant anonyme ne doit jamais
// pouvoir injecter un événement réservé aux call sites internes authentifiés
// (checkout_started, account_created, ...).
export const PUBLIC_ANALYTICS_EVENT_NAMES = [
  AnalyticsEventName.CALCULATOR_VIEWED,
] as const;

export class TrackPublicEventDto {
  @IsIn(PUBLIC_ANALYTICS_EVENT_NAMES)
  event_name!: (typeof PUBLIC_ANALYTICS_EVENT_NAMES)[number];

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}
