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
import { Alert, ConfirmDialog, Skeleton } from '@/components/ui';

function formatCost(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

function formatEuros(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
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
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

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

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <Skeleton className="h-40 rounded-[2rem]" />
        <Skeleton className="mt-6 h-72 rounded-[2rem]" />
      </main>
    );
  }

  if (error || !project) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Alert variant="error">{error || 'Projet non trouvé'}</Alert>
        <Link
          href="/community"
          className="mt-4 inline-block text-sm text-stone-500 hover:text-stone-700"
        >
          &larr; Retour à la galerie
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
        &larr; Retour à la galerie
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
              onClick={() => setShowWithdrawConfirm(true)}
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
          Photos avant / après
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
              Coût total
            </p>
            <p className="mt-2 text-lg font-semibold text-stone-950">
              {formatCost(project.total_cost_cents)}
            </p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              Durée
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

      {/* Liste d'achats réelle (COM-1) */}
      {project.purchase_list ? (
        <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-stone-950">
              Liste d&apos;achats réelle
            </h2>
            {project.budget_summary && project.budget_summary.savings_amount > 0 && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {formatEuros(project.budget_summary.savings_amount)} d&apos;économies
                ({project.budget_summary.savings_percent.toFixed(1)} %)
              </span>
            )}
          </div>

          <div className="mt-4 space-y-2">
            {project.purchase_list.material_items.map((item) => (
              <div
                key={item.material_id}
                className="flex flex-col gap-1 rounded-xl bg-stone-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-stone-900">
                    {item.material_name}
                  </p>
                  <p className="text-xs text-stone-500">
                    {item.units_needed} x {item.packaging_label}
                    {item.store_name ? ` · ${item.store_name}` : ''}
                  </p>
                </div>
                {item.real_unit_price != null && (
                  <span className="text-sm font-semibold text-stone-950">
                    {formatEuros(item.real_unit_price * item.units_needed)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {project.budget_summary && (
            <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-4">
              <span className="text-sm text-stone-500">Coût total réel</span>
              <span className="text-lg font-semibold text-stone-950">
                {formatEuros(project.budget_summary.total_real_cost)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 text-sm text-stone-500 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          Détails des achats non disponibles pour cette publication.
        </div>
      )}

      {/* Comments */}
      <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <CommunityComments communityProjectId={communityProjectId} />
      </div>

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
    </main>
  );
}
