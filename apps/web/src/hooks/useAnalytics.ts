'use client';

import { useCallback } from 'react';
import { apiPost } from '@/lib/api';

export function useAnalytics() {
  const track = useCallback(
    (eventName: string, properties: Record<string, unknown> = {}) => {
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
      apiPost('/public/analytics/events', {
        event_name: eventName,
        properties,
      }).catch(() => {});
    },
    [],
  );

  return { track };
}
