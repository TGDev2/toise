'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function useAdminAuth() {
  const { appUser, isLoading } = useAuth();
  const router = useRouter();
  const isAdmin = appUser?.role === 'admin';

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace('/login');
    }
  }, [isLoading, isAdmin, router]);

  return { appUser, isLoading, isAdmin };
}
