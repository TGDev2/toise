'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiGet } from '@/lib/api';
import { useAuth } from './AuthContext';

interface FeatureGateConfig {
  feature_key: string;
  label_fr: string;
  description_fr: string | null;
  min_tier: string;
  is_enabled: boolean;
}

interface FeatureGateContextType {
  gates: FeatureGateConfig[];
  isLoading: boolean;
  isFeatureAllowed: (featureKey: string) => boolean;
  getGateConfig: (featureKey: string) => FeatureGateConfig | undefined;
  showPaywall: (featureKey: string) => void;
  paywallFeature: string | null;
  closePaywall: () => void;
}

const TIER_RANK: Record<string, number> = {
  free: 0,
  pro: 1,
  contractor_essentiel: 2,
  contractor_standard: 3,
  contractor_premium: 4,
};

const FeatureGateContext = createContext<FeatureGateContextType | null>(null);

// Référence stable pour éviter de recréer les callbacks dépendant de `gates`.
const EMPTY_GATES: FeatureGateConfig[] = [];

export function FeatureGateProvider({ children }: { children: ReactNode }) {
  const { appUser } = useAuth();
  // Gates rattachés à l'utilisateur qui les a chargés : évite d'exposer les
  // gates d'une session précédente après un changement de compte.
  const [fetched, setFetched] = useState<{
    userId: string;
    gates: FeatureGateConfig[];
  } | null>(null);
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null);

  useEffect(() => {
    if (!appUser) return;

    const userId = appUser.id;
    let cancelled = false;
    apiGet<FeatureGateConfig[]>('/feature-gates')
      .then((data) => {
        if (!cancelled) setFetched({ userId, gates: data });
      })
      .catch(() => {
        // Fail-closed : aucune feature payante accessible si le chargement échoue.
        if (!cancelled) setFetched({ userId, gates: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [appUser]);

  const gates =
    appUser && fetched?.userId === appUser.id ? fetched.gates : EMPTY_GATES;
  const isLoading = Boolean(appUser) && fetched?.userId !== appUser?.id;

  const isFeatureAllowed = useCallback(
    (featureKey: string): boolean => {
      if (!appUser) return false;
      const gate = gates.find((g) => g.feature_key === featureKey);
      if (!gate) return false; // unknown feature = fail-closed (matches API contract)
      if (!gate.is_enabled) return false;

      const userRank = TIER_RANK[appUser.subscription_tier] ?? 0;
      const requiredRank = TIER_RANK[gate.min_tier] ?? 1;
      return userRank >= requiredRank;
    },
    [appUser, gates],
  );

  const getGateConfig = useCallback(
    (featureKey: string): FeatureGateConfig | undefined => {
      return gates.find((g) => g.feature_key === featureKey);
    },
    [gates],
  );

  const showPaywall = useCallback((featureKey: string) => {
    setPaywallFeature(featureKey);
  }, []);

  const closePaywall = useCallback(() => {
    setPaywallFeature(null);
  }, []);

  return (
    <FeatureGateContext.Provider
      value={{
        gates,
        isLoading,
        isFeatureAllowed,
        getGateConfig,
        showPaywall,
        paywallFeature,
        closePaywall,
      }}
    >
      {children}
    </FeatureGateContext.Provider>
  );
}

export function useFeatureGates() {
  const context = useContext(FeatureGateContext);
  if (!context) {
    throw new Error(
      'useFeatureGates must be used within a FeatureGateProvider',
    );
  }
  return context;
}
