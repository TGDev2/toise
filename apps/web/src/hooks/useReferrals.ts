'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet } from '@/lib/api';

export interface ReferralStats {
  code: string;
  share_url: string;
  referred_count: number;
  converted_count: number;
  months_offered: number;
}

export function useReferrals() {
  const { appUser } = useAuth();
  const [data, setData] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!appUser) return;
    setIsLoading(true);
    setError('');
    try {
      const stats = await apiGet<ReferralStats>('/referrals/me');
      setData(stats);
    } catch {
      setError('Impossible de charger vos informations de parrainage.');
    } finally {
      setIsLoading(false);
    }
  }, [appUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
}
