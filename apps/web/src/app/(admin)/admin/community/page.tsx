'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPut } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { WORK_TYPE_LABELS } from '@/lib/project-types';
import type { PaginationMeta } from '@/lib/project-types';
import type {
  ShoppingListMaterialItem,
  ShoppingListComplementaryItem,
  BudgetSummary,
} from '@/lib/shopping-list-types';

interface PendingProject {
  id: string;
  title: string;
  work_type: string;
  user_display_name: string;
  total_cost_cents: number;
  duration_days: number;
  description: string | null;
  length_cm: number;
  width_cm: number;
  height_cm: number | null;
  before_photo_ids: string[];
  after_photo_ids: string[];
  purchase_list: {
    material_items: ShoppingListMaterialItem[];
    complementary_items: ShoppingListComplementaryItem[];
  } | null;
  budget_summary: BudgetSummary | null;
  created_at: string;
}

interface PendingResponse {
  data: PendingProject[];
  meta: PaginationMeta;
}

export default function AdminCommunityPage() {
  const [projects, setProjects] = useState<PendingProject[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPending = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const result = await apiGet<PendingResponse>(
        `/community/admin/pending?page=${page}&limit=20`,
      );
      setProjects(result.data);
      setMeta(result.meta);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de charger les projets'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    setError('');
    try {
      await apiPut(`/community/admin/${id}/moderate`, { action: 'approve' });
      setFeedback('Projet approuve.');
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de moderer le projet'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    setError('');
    try {
      await apiPut(`/community/admin/${id}/moderate`, {
        action: 'reject',
        rejection_reason: rejectionReason.trim() || undefined,
      });
      setFeedback('Projet rejete.');
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setRejectingId(null);
      setRejectionReason('');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de moderer le projet'));
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) =>
    new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));

  const formatCost = (cents: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">
        Modération galerie communautaire
      </h1>
      <p className="mt-2 text-sm text-[var(--foreground)]/60">
        {meta.total} projet{meta.total > 1 ? 's' : ''} en attente de
        modération
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {feedback && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}
        </div>
      )}

      {loading && (
        <p className="mt-6 text-sm text-[var(--foreground)]/60">
          Chargement...
        </p>
      )}

      {!loading && projects.length === 0 && (
        <p className="mt-6 text-sm text-[var(--foreground)]/60">
          Aucun projet en attente de modération.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {projects.map((project) => (
          <div
            key={project.id}
            className="rounded-xl border border-[var(--foreground)]/10 bg-white p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]/50">
                  {WORK_TYPE_LABELS[project.work_type] ?? project.work_type}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                  {project.title}
                </h2>
                <p className="mt-1 text-sm text-[var(--foreground)]/60">
                  par {project.user_display_name} - soumis le{' '}
                  {formatDate(project.created_at)}
                </p>
              </div>
            </div>

            {project.description && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--foreground)]/70">
                {project.description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--foreground)]/60">
              <span>Coût : {formatCost(project.total_cost_cents)}</span>
              <span>
                Durée : {project.duration_days} jour
                {project.duration_days > 1 ? 's' : ''}
              </span>
              <span>
                Dimensions : {(project.length_cm / 100).toFixed(1)} x{' '}
                {(project.width_cm / 100).toFixed(1)} m
              </span>
              <span>
                Photos : {project.before_photo_ids.length} avant,{' '}
                {project.after_photo_ids.length} après
              </span>
            </div>

            {project.purchase_list ? (
              <div className="mt-3">
                <span className="text-xs font-medium text-[var(--foreground)]/50">
                  Liste d&apos;achats réelle :
                </span>
                <span className="ml-1 text-sm text-[var(--foreground)]/70">
                  {project.purchase_list.material_items.length} article
                  {project.purchase_list.material_items.length > 1 ? 's' : ''}
                  {project.budget_summary &&
                    ` · coût réel ${formatCost(
                      Math.round(project.budget_summary.total_real_cost * 100),
                    )}`}
                  {project.budget_summary &&
                    project.budget_summary.savings_amount > 0 &&
                    ` · économie ${project.budget_summary.savings_percent.toFixed(1)} %`}
                </span>
              </div>
            ) : (
              <div className="mt-3">
                <span className="text-xs font-medium text-[var(--foreground)]/50">
                  Liste d&apos;achats réelle : non disponible
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => handleApprove(project.id)}
                disabled={actionLoading === project.id}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Approuver
              </button>
              {rejectingId === project.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Raison du rejet (optionnel)"
                    className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleReject(project.id)}
                    disabled={actionLoading === project.id}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirmer le rejet
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingId(null);
                      setRejectionReason('');
                    }}
                    className="text-sm text-stone-500 hover:text-stone-700"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setRejectingId(project.id)}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Rejeter
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={meta.page <= 1}
            onClick={() => fetchPending(meta.page - 1)}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Précédent
          </button>
          <span className="text-sm text-stone-600">
            Page {meta.page} / {meta.totalPages}
          </span>
          <button
            type="button"
            disabled={meta.page >= meta.totalPages}
            onClick={() => fetchPending(meta.page + 1)}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
