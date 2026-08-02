'use client';

import { useCallback } from 'react';
import { apiPost } from '@/lib/api';
import { isAnalyticsAllowed } from '@/lib/analytics-consent';

// Même contrat que `lib/pwa-analytics` : le consentement conditionne l'émission,
// et `isAnalyticsAllowed()` en est l'unique énoncé. Un bandeau dont le refus
// n'arrêterait que la moitié des émetteurs ne serait pas un bandeau.

export function useAnalytics() {
  const track = useCallback(
    (eventName: string, properties: Record<string, unknown> = {}) => {
      if (!isAnalyticsAllowed()) return;
      apiPost('/analytics/events', {
        event_name: eventName,
        properties,
      }).catch(() => {});
    },
    [],
  );

  return { track };
}

// Pour les pages publiques (calculateurs) : visiteurs pas encore authentifiés.
// Poste vers l'endpoint public (auth optionnelle), restreint à une allow-list
// d'événements côté API — voir PublicAnalyticsController.
export function usePublicAnalytics() {
  const track = useCallback(
    (eventName: string, properties: Record<string, unknown> = {}) => {
      if (!isAnalyticsAllowed()) return;
      apiPost('/public/analytics/events', {
        event_name: eventName,
        properties,
      }).catch(() => {});
    },
    [],
  );

  return { track };
}
