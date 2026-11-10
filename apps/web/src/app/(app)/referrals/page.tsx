'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useReferrals } from '@/hooks/useReferrals';
import { Alert, Skeleton } from '@/components/ui';

export default function ReferralsPage() {
  const { appUser, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { data, isLoading, error } = useReferrals();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !appUser) {
      router.push('/login');
    }
  }, [authLoading, appUser, router]);

  const handleCopy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silencieux : le lien reste sélectionnable/copiable à la main.
    }
  };

  if (authLoading || isLoading || !data) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-64 rounded-[2rem]" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
        >
          &larr; Retour au dashboard
        </Link>
      </div>

      <div className="rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)] sm:p-8">
        <h1 className="text-2xl font-semibold text-stone-950">Parrainage</h1>
        <p className="mt-2 text-sm text-stone-600">
          Offrez Toisé à vos proches : dès qu&apos;un filleul souscrit un
          abonnement, vous recevez <strong>1 mois de Pro offert</strong>.
        </p>

        {error && (
          <Alert variant="error" className="mt-4">
            {error}
          </Alert>
        )}

        <div className="mt-6 flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={data.share_url}
            className="min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-700"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-strong)]"
          >
            {copied ? 'Copié !' : 'Copier'}
          </button>
        </div>
        <p className="mt-2 text-xs text-stone-400">
          Votre code : <span className="font-mono">{data.code}</span>
        </p>

        <div className="mt-8 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-2xl font-bold text-stone-900">
              {data.referred_count}
            </p>
            <p className="mt-1 text-xs text-stone-500">Filleuls</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-2xl font-bold text-stone-900">
              {data.converted_count}
            </p>
            <p className="mt-1 text-xs text-stone-500">Abonnés</p>
          </div>
          <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-4">
            <p className="text-2xl font-bold text-[var(--accent-strong)]">
              {data.months_offered}
            </p>
            <p className="mt-1 text-xs text-stone-500">Mois offerts</p>
          </div>
        </div>
      </div>
    </main>
  );
}
