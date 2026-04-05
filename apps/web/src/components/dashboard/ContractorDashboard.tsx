'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { apiDelete, apiGet, apiPost } from '@/lib/api';
import type { Quote, Client } from '@/lib/quote-types';
import { getErrorMessage } from '@/lib/errors';
import type { PaginatedProjects, ProjectSummary } from '@/lib/project-types';
import { ProjectCard } from './ProjectCard';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface CompanyProfileData {
  raison_sociale: string;
  siret: string;
  city: string;
  specialties: string[];
}

export function ContractorDashboard() {
  const { appUser, logout, deleteAccount } = useAuth();
  const { subscription, openPortal } = useSubscription();
  const router = useRouter();

  const [companyProfile, setCompanyProfile] = useState<CompanyProfileData | null>(null);
  const [apiProjects, setApiProjects] = useState<ProjectSummary[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 12, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [apiLoading, setApiLoading] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [isAccountDeleting, setIsAccountDeleting] = useState(false);
  const [form, setForm] = useState({ name: 'Renovation salon', room_name: 'Salon' });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [clientsCount, setClientsCount] = useState<number | null>(null);
  const [quotesCount, setQuotesCount] = useState<number | null>(null);

  // Fetch company profile + stats
  useEffect(() => {
    if (!appUser) return;
    apiGet<CompanyProfileData>('/company-profiles/me')
      .then(setCompanyProfile)
      .catch(() => {});
    apiGet<Client[]>('/clients')
      .then((cls) => setClientsCount(cls.length))
      .catch(() => {});
    apiGet<Quote[]>('/quotes')
      .then((qs) => setQuotesCount(qs.length))
      .catch(() => {});
  }, [appUser]);

  const fetchProjects = useCallback(async (targetPage: number) => {
    setApiLoading(true);
    setError('');
    try {
      const result = await apiGet<PaginatedProjects>(
        `/projects?page=${targetPage}&limit=12`,
      );
      setApiProjects(result.data);
      setMeta(result.meta);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de charger les projets'));
    } finally {
      setApiLoading(false);
    }
  }, []);

  useEffect(() => {
    if (appUser) fetchProjects(page);
  }, [appUser, page, fetchProjects]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleDeleteAccount = async () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Supprimer definitivement votre compte et vos donnees ?')
    ) {
      return;
    }
    setError('');
    setIsAccountDeleting(true);
    try {
      await deleteAccount();
      router.push('/login');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de supprimer le compte'));
    } finally {
      setIsAccountDeleting(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    try {
      const created = await apiPost<{ id: string }>('/projects', {
        name: form.name.trim(),
        room_name: form.room_name.trim(),
      });
      router.push(`/projects/${created.id}/photos`);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de creer le projet'));
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setError('');
    try {
      await apiDelete(`/projects/${deleteTarget.id}`);
      setDeleteTarget(null);
      setFeedback('Projet supprime avec succes.');
      await fetchProjects(page);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de supprimer le projet'));
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteDialog = (projectId: string) => {
    const project = apiProjects.find((p) => p.id === projectId);
    if (project) {
      setDeleteTarget({ id: project.id, name: project.name });
    }
  };

  if (!appUser) return null;

  const nextBilling = subscription?.current_period_end
    ? new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(new Date(subscription.current_period_end))
    : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)] lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            Espace Professionnel
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">
            {companyProfile?.raison_sociale ?? 'Mon entreprise'}
          </h1>
          {companyProfile && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-stone-500">
              <span>SIRET : {companyProfile.siret}</span>
              <span className="text-stone-300">|</span>
              <span>{companyProfile.city}</span>
            </div>
          )}
          {companyProfile?.specialties && companyProfile.specialties.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {companyProfile.specialties.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-blue-50 px-3 py-0.5 text-xs font-medium text-blue-700"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-sm text-stone-500">{appUser.email}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsComposerOpen((v) => !v)}
            className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
          >
            {isComposerOpen ? 'Fermer' : 'Nouveau chantier'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/quotes')}
            className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
          >
            Mes devis
          </button>
          <button
            type="button"
            onClick={() => router.push('/settings/company')}
            className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
          >
            Profil entreprise
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
          >
            Deconnexion
          </button>
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={isAccountDeleting}
            className="rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-700 hover:-translate-y-0.5 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAccountDeleting ? 'Suppression...' : 'Supprimer mon compte'}
          </button>
        </div>
      </div>

      {/* Subscription Card */}
      <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 px-6 py-4 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-stone-900">
              Plan Contractor
              {subscription?.cancel_at_period_end && (
                <span className="ml-2 text-xs font-normal text-amber-600">
                  (annulation prevue)
                </span>
              )}
            </p>
            {nextBilling && (
              <p className="mt-1 text-xs text-stone-500">
                {subscription?.cancel_at_period_end
                  ? `Actif jusqu'au ${nextBilling}`
                  : `Prochain prelevement le ${nextBilling}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={openPortal}
            className="shrink-0 rounded-full border border-stone-300 px-5 py-2 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
          >
            Gerer mon abonnement
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 bg-white/85 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Chantiers
          </p>
          <p className="mt-1 text-2xl font-bold text-stone-900">{meta.total}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white/85 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Clients
          </p>
          <p className="mt-1 text-2xl font-bold text-stone-900">
            {clientsCount ?? '-'}
          </p>
        </div>
        <div
          onClick={() => router.push('/quotes')}
          className="cursor-pointer rounded-2xl border border-stone-200 bg-white/85 p-4 hover:border-stone-300 transition-colors"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Devis
          </p>
          <p className="mt-1 text-2xl font-bold text-stone-900">
            {quotesCount ?? '-'}
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white/85 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Ce mois
          </p>
          <p className="mt-1 text-2xl font-bold text-stone-500">-</p>
          <p className="text-xs text-stone-400">Bientot disponible</p>
        </div>
      </div>

      {/* Feedback & Error */}
      {feedback && (
        <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          {feedback}
        </div>
      )}
      {error && (
        <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Create Project Form */}
      {isComposerOpen && (
        <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-xl font-semibold text-stone-950">
            Nouveau chantier
          </h2>
          <form onSubmit={handleCreateProject} className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-stone-700">
                Nom du chantier
              </span>
              <input
                required
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-stone-700">
                Piece concernee
              </span>
              <input
                required
                value={form.room_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, room_name: e.target.value }))
                }
                className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-stone-800"
              >
                Creer le chantier
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Mes Chantiers */}
      <section className="mt-6">
        <h2 className="mb-4 text-lg font-semibold text-stone-900">
          Mes chantiers
        </h2>
        {apiLoading && (
          <div className="flex justify-center">
            <p className="text-sm text-stone-500">Chargement des chantiers...</p>
          </div>
        )}
        {!apiLoading && apiProjects.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {apiProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDelete={openDeleteDialog}
              />
            ))}
          </div>
        )}
        {!apiLoading && apiProjects.length === 0 && !isComposerOpen && (
          <div className="rounded-[2rem] border-2 border-dashed border-stone-300 bg-white/60 p-12 text-center">
            <h3 className="text-xl font-semibold text-stone-950">
              Aucun chantier pour le moment
            </h3>
            <p className="mt-3 text-sm text-stone-600">
              Creez votre premier chantier pour commencer.
            </p>
            <button
              type="button"
              onClick={() => setIsComposerOpen(true)}
              className="mt-6 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
            >
              Creer mon premier chantier
            </button>
          </div>
        )}
      </section>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            &larr; Precedent
          </button>
          <span className="text-sm text-stone-600">
            Page {meta.page} / {meta.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Suivant &rarr;
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        projectName={deleteTarget?.name ?? ''}
        onConfirm={handleDeleteProject}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />
    </main>
  );
}
