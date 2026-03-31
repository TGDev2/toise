'use client';

import { useCallback } from 'react';
import { useFeatureGates } from '@/contexts/FeatureGateContext';

export function useFeatureGate(featureKey: string) {
  const { isFeatureAllowed, getGateConfig, showPaywall } = useFeatureGates();
  const allowed = isFeatureAllowed(featureKey);
  const gate = getGateConfig(featureKey);

  const guardAction = useCallback(
    (action: () => void) => {
      if (allowed) {
        action();
      } else {
        showPaywall(featureKey);
      }
    },
    [allowed, featureKey, showPaywall],
  );

  return { allowed, gate, guardAction };
}
