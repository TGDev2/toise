'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/hooks/useAnalytics';

export default function SubscriptionSuccessPage() {
  const router = useRouter();
  const { syncWithBackend } = useAuth();
  const { track } = useAnalytics();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    syncWithBackend();
    track('subscription_started', { plan: 'pro', source: 'checkout' });
  }, [syncWithBackend, track]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-8 text-center shadow-[0_25px_80px_rgba(67,39,15,0.10)]">
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-7 w-7 text-emerald-600"
            >
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-stone-900">
          Bienvenue dans Chiffréo Pro !
        </h1>
        <p className="mt-3 text-sm text-stone-600">
          Votre essai gratuit de 7 jours a commence. Toutes les fonctionnalités
          Pro sont maintenant deverrouillees.
        </p>

        <button
          onClick={() => router.push('/dashboard')}
          className="mt-6 w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
        >
          Acceder a mes projets
        </button>

        <p className="mt-3 text-xs text-stone-400">
          Redirection automatique dans {countdown}s...
        </p>
      </div>
    </main>
  );
}
