'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-[2rem] border border-stone-200 bg-white p-8 text-center shadow-[0_25px_80px_rgba(67,39,15,0.10)]">
        <h1 className="text-2xl font-semibold text-stone-950">
          Une erreur est survenue
        </h1>
        <p className="mt-3 text-sm text-stone-600">
          Quelque chose s&apos;est mal passé. Vous pouvez réessayer ou revenir
          au tableau de bord.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={reset}>Réessayer</Button>
          <Button
            variant="secondary"
            onClick={() => {
              window.location.href = '/dashboard';
            }}
          >
            Tableau de bord
          </Button>
        </div>
      </div>
    </main>
  );
}
