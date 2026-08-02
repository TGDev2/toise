import { IsIn, IsObject, IsOptional } from 'class-validator';
import { AnalyticsEventName } from '../analytics-event-name.enum';

// Allow-list volontairement restreinte : un appelant anonyme ne doit jamais
// pouvoir injecter un événement réservé aux call sites internes authentifiés
// (checkout_started, account_created, ...).
// Les événements PWA sont émis depuis `layout.tsx`, monté sur tout le site — y
// compris les pages publiques — et souvent hors session : ils passent donc par cet
// endpoint. `photo_quality_rejected` en est volontairement absent : il est émis
// côté serveur, un client ne doit pas pouvoir fabriquer un taux de rejet caméra.
export const PUBLIC_ANALYTICS_EVENT_NAMES = [
  AnalyticsEventName.CALCULATOR_VIEWED,
  AnalyticsEventName.QUOTE_CHECK_VIEWED,
  AnalyticsEventName.PWA_SESSION_START,
  AnalyticsEventName.PWA_INSTALL_PROMPTED,
  AnalyticsEventName.PWA_INSTALL_ACCEPTED,
  AnalyticsEventName.PWA_INSTALL_DISMISSED,
  AnalyticsEventName.PWA_INSTALLED,
  AnalyticsEventName.PWA_OFFLINE_VIEW,
] as const;

export class TrackPublicEventDto {
  @IsIn(PUBLIC_ANALYTICS_EVENT_NAMES)
  event_name!: (typeof PUBLIC_ANALYTICS_EVENT_NAMES)[number];

  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;
}
