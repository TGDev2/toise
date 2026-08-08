'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/lib/errors';

/**
 * Entrée sans compte, extraite de la page d'accueil quand celle-ci est
 * redevenue un composant serveur (E3-1).
 *
 * Elle survit à la suppression de la landing particulier parce que le mode
 * invité n'en faisait pas partie : l'ADR 0002 (D4) le préserve explicitement
 * comme surface d'acquisition, au même titre que les calculateurs publics. La
 * suppression portait sur la page d'accueil orientée bricoleur, pas sur le
 * canal.
 */
export function GuestStartButton({ className = '' }: { className?: string }) {
  const { appUser, isGuest, isLoading, startGuestSession } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const hasSession = Boolean(appUser) || isGuest;

  const handleStartProject = async () => {
    setError('');

    if (hasSession) {
      router.push('/dashboard');
      return;
    }

    setLoading(true);
    try {
      await startGuestSession();
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de démarrer le mode invité'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleStartProject}
        disabled={loading || isLoading}
        className={`rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        {loading
          ? 'Démarrage...'
          : hasSession
            ? 'Reprendre mon projet'
            : 'Essayer sans compte'}
      </button>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
