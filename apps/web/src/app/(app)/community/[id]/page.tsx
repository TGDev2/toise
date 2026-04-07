'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiDelete, apiGet } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { WORK_TYPE_LABELS } from '@/lib/project-types';
import type { CommunityProjectDetail } from '@/lib/community-types';
import { useAuth } from '@/contexts/AuthContext';
import { CommunityPhotoCompare } from '@/components/community/CommunityPhotoCompare';
import { CommunityLikeButton } from '@/components/community/CommunityLikeButton';
import { CommunityComments } from '@/components/community/CommunityComments';

function formatCost(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export default function CommunityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { appUser } = useAuth();
  const communityProjectId = params.id as string;

  const [project, setProject] = useState<CommunityProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const result = await apiGet<CommunityProjectDetail>(
        `/community/${communityProjectId}`,
      );
      setProject(result);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de charger le projet'));
    } finally {
      setLoading(false);
    }
  }, [communityProjectId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleWithdraw = async () => {
    if (
      !window.confirm(
        'Retirer ce projet de la galerie ? Cette action est irreversible.',
      )
    ) {
      return;
    }
    setWithdrawing(true);
    try {
      await apiDelete(`/community/${communityProjectId}`);
      router.push('/community');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de retirer le projet'));
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error || 'Projet non trouve'}
        </div>
        <Link
          href="/community"
          className="mt-4 inline-block text-sm text-stone-500 hover:text-stone-700"
        >
          &larr; Retour a la galerie
        </Link>
      </main>
    );
  }

  const workTypeLabel =
    WORK_TYPE_LABELS[project.work_type] ?? project.work_type;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      {/* Back link */}
      <Link
        href="/community"
        className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700"
      >
        &larr; Retour a la galerie
      </Link>

      {/* Header */}
      <div className="mt-4 rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
          {workTypeLabel}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-stone-950">
          {project.title}
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          par {project.user_display_name}
          {project.published_at &&
            ` - ${new Intl.DateTimeFormat('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            }).format(new Date(project.published_at))}`}
        </p>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <CommunityLikeButton
            communityProjectId={communityProjectId}
            initialLiked={project.has_liked}
            initialCount={project.likes_count}
            disabled={!appUser}
          />
          {project.is_owner && (
            <button
              type="button"
              onClick={handleWithdraw}
              disabled={withdrawing}
              className="rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 hover:-translate-y-0.5 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {withdrawing ? 'Retrait...' : 'Retirer de la galerie'}
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-lg font-semibold text-stone-950">Description</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-stone-600">
            {project.description}
          </p>
        </div>
      )}

      {/* Photos */}
      <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="mb-4 text-lg font-semibold text-stone-950">
          Photos avant / apres
        </h2>
        <CommunityPhotoCompare
          communityProjectId={communityProjectId}
          beforePhotoIds={project.before_photo_ids}
          afterPhotoIds={project.after_photo_ids}
        />
      </div>

      {/* Project info */}
      <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="text-lg font-semibold text-stone-950">
          Informations du projet
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              Cout total
            </p>
            <p className="mt-2 text-lg font-semibold text-stone-950">
              {formatCost(project.total_cost_cents)}
            </p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              Duree
            </p>
            <p className="mt-2 text-lg font-semibold text-stone-950">
              {project.duration_days} jour{project.duration_days > 1 ? 's' : ''}
            </p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              Dimensions
            </p>
            <p className="mt-2 text-sm font-semibold text-stone-950">
              {(project.length_cm / 100).toFixed(1)} x{' '}
              {(project.width_cm / 100).toFixed(1)} m
              {project.height_cm != null &&
                ` x ${(project.height_cm / 100).toFixed(1)} m`}
            </p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              Type de travaux
            </p>
            <p className="mt-2 text-lg font-semibold text-stone-950">
              {workTypeLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Materials */}
      {project.materials_list.length > 0 && (
        <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-lg font-semibold text-stone-950">
            Materiaux utilises
          </h2>
          <div className="mt-4 space-y-2">
            {project.materials_list.map((mat, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3"
              >
                <span className="text-sm text-stone-700">{mat.name}</span>
                <span className="text-sm font-medium text-stone-950">
                  {mat.quantity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <CommunityComments communityProjectId={communityProjectId} />
      </div>
    </main>
  );
}
