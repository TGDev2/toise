'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGates } from '@/contexts/FeatureGateContext';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { MilestoneStatus, SiteMilestone } from '@/lib/site-tracking-types';
import {
  MILESTONE_NEXT_STATUS,
  MILESTONE_STATUS_COLORS,
  MILESTONE_STATUS_LABELS,
} from '@/lib/site-tracking-types';
import { Alert, Button, ConfirmDialog, Input, Skeleton } from '@/components/ui';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${MILESTONE_STATUS_COLORS[status]}`}
    >
      {MILESTONE_STATUS_LABELS[status]}
    </span>
  );
}

export default function SiteTrackingPage() {
  const { appUser, isLoading } = useAuth();
  const { isFeatureAllowed, showPaywall } = useFeatureGates();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [projectName, setProjectName] = useState('');
  const [milestones, setMilestones] = useState<SiteMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SiteMilestone | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!appUser) {
      router.push('/login');
      return;
    }
    if (!isFeatureAllowed('site_tracking')) {
      showPaywall('site_tracking');
    }
  }, [appUser, isLoading, isFeatureAllowed, showPaywall, router]);

  const fetchMilestones = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [project, items] = await Promise.all([
        apiGet<{ name: string }>(`/projects/${projectId}`),
        apiGet<SiteMilestone[]>(`/projects/${projectId}/milestones`),
      ]);
      setProjectName(project.name);
      setMilestones(items);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de charger le suivi de chantier'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (appUser) fetchMilestones();
  }, [appUser, fetchMilestones]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!label.trim()) return;
    setIsCreating(true);
    setError('');
    try {
      await apiPost(`/projects/${projectId}/milestones`, {
        label: label.trim(),
        planned_date: plannedDate || undefined,
      });
      setLabel('');
      setPlannedDate('');
      await fetchMilestones();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Impossible d'ajouter le jalon"));
    } finally {
      setIsCreating(false);
    }
  };

  const advanceStatus = async (milestone: SiteMilestone) => {
    const nextStatus = MILESTONE_NEXT_STATUS[milestone.status];
    if (!nextStatus) return;
    setBusyId(milestone.id);
    setError('');
    try {
      await apiPatch(`/projects/${projectId}/milestones/${milestone.id}`, {
        status: nextStatus,
      });
      await fetchMilestones();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de mettre à jour le jalon'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setError('');
    try {
      await apiDelete(`/projects/${projectId}/milestones/${deleteTarget.id}`);
      setDeleteTarget(null);
      await fetchMilestones();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de supprimer le jalon'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          &larr; Retour au dashboard
        </button>
        <h1 className="mt-2 text-3xl font-semibold text-stone-950">
          Suivi de chantier
        </h1>
        {projectName && (
          <p className="mt-1 text-sm text-stone-500">{projectName}</p>
        )}
      </div>

      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      <section className="mb-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="mb-4 text-lg font-semibold text-stone-900">
          Ajouter un jalon
        </h2>
        <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-[2fr_1fr_auto]">
          <Input
            label="Jalon"
            placeholder="Démolition, plomberie, peinture..."
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Input
            label="Date prévue"
            type="date"
            value={plannedDate}
            onChange={(e) => setPlannedDate(e.target.value)}
          />
          <div className="flex items-end">
            <Button type="submit" loading={isCreating} className="w-full sm:w-auto">
              Ajouter
            </Button>
          </div>
        </form>
      </section>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-3xl" />
          <Skeleton className="h-20 rounded-3xl" />
        </div>
      )}

      {!loading && milestones.length === 0 && (
        <div className="rounded-[2rem] border-2 border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <h3 className="text-xl font-semibold text-stone-950">
            Aucun jalon pour le moment
          </h3>
          <p className="mt-3 text-sm text-stone-600">
            Ajoutez les grandes étapes du chantier pour suivre son avancement.
          </p>
        </div>
      )}

      {!loading && milestones.length > 0 && (
        <ol className="space-y-3">
          {milestones.map((milestone) => {
            const nextStatus = MILESTONE_NEXT_STATUS[milestone.status];
            return (
              <li
                key={milestone.id}
                className="rounded-3xl border border-stone-200 bg-white/85 p-5 shadow-[0_15px_40px_rgba(67,39,15,0.06)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-stone-950">
                      {milestone.label}
                    </span>
                    <MilestoneStatusBadge status={milestone.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    {nextStatus && (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={busyId === milestone.id}
                        onClick={() => advanceStatus(milestone)}
                      >
                        Marquer {MILESTONE_STATUS_LABELS[nextStatus].toLowerCase()}
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(milestone)}
                      className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:-translate-y-0.5 hover:bg-red-50"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-500">
                  <span>
                    Prévu :{' '}
                    {milestone.planned_date
                      ? formatDate(milestone.planned_date)
                      : 'non défini'}
                  </span>
                  <span>
                    Réel :{' '}
                    {milestone.actual_date
                      ? formatDate(milestone.actual_date)
                      : '—'}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Supprimer le jalon"
        message={
          <>
            Vous allez supprimer le jalon{' '}
            <span className="font-semibold text-stone-800">
              {deleteTarget?.label}
            </span>
            .
          </>
        }
        confirmLabel="Confirmer la suppression"
        destructive
        busy={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}
