'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiDelete, apiGet } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { CommunityProjectDetail } from '@/lib/community-types';
import { useAuth } from '@/contexts/AuthContext';
import { CommunityLikeButton } from './CommunityLikeButton';
import { ConfirmDialog } from '@/components/ui';

interface CommunityDetailActionsProps {
  communityProjectId: string;
  initialLikesCount: number;
}

type ViewerState = Pick<
  CommunityProjectDetail,
  'has_liked' | 'is_owner' | 'likes_count'
>;

/**
 * Le rendu de la page projet est fait côté serveur (SSR, anonyme) pour le
 * SEO — `has_liked`/`is_owner` n'y sont donc jamais fiables : le cookie
 * `chiffreo_auth` n'est qu'un marqueur, pas le jeton Firebase. Ce composant
 * refait son propre appel côté client pour résoudre l'état personnalisé,
 * comme `CommunityComments` le fait déjà pour les commentaires.
 */
export function CommunityDetailActions({
  communityProjectId,
  initialLikesCount,
}: CommunityDetailActionsProps) {
  const router = useRouter();
  const { appUser } = useAuth();
  const [viewerState, setViewerState] = useState<ViewerState | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiGet<CommunityProjectDetail>(`/community/${communityProjectId}`)
      .then((result) => {
        if (cancelled) return;
        setViewerState({
          has_liked: result.has_liked,
          is_owner: result.is_owner,
          likes_count: result.likes_count,
        });
      })
      .catch(() => {
        // Le contenu public est déjà affiché par la page serveur ; un échec
        // ici laisse juste les actions personnalisées indisponibles.
      });
    return () => {
      cancelled = true;
    };
  }, [communityProjectId]);

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      await apiDelete(`/community/${communityProjectId}`);
      router.push('/community');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de retirer le projet'));
      setWithdrawing(false);
      setShowWithdrawConfirm(false);
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {viewerState ? (
        <CommunityLikeButton
          communityProjectId={communityProjectId}
          initialLiked={viewerState.has_liked}
          initialCount={viewerState.likes_count}
          disabled={!appUser}
        />
      ) : (
        <span className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-400">
          {initialLikesCount}
        </span>
      )}

      {viewerState?.is_owner && (
        <button
          type="button"
          onClick={() => setShowWithdrawConfirm(true)}
          disabled={withdrawing}
          className="rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 hover:-translate-y-0.5 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {withdrawing ? 'Retrait...' : 'Retirer de la galerie'}
        </button>
      )}

      {error && <p className="w-full text-sm text-red-600">{error}</p>}

      <ConfirmDialog
        open={showWithdrawConfirm}
        title="Retirer de la galerie"
        message="Ce projet sera retiré de la galerie communautaire. Cette action est irréversible."
        confirmLabel="Retirer"
        destructive
        busy={withdrawing}
        onConfirm={handleWithdraw}
        onCancel={() => setShowWithdrawConfirm(false)}
      />
    </div>
  );
}
