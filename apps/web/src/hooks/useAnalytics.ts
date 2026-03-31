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
