'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { apiDelete, apiGet, apiPost } from '@/lib/api';
import type { Quote, Client } from '@/lib/quote-types';
import { getErrorMessage } from '@/lib/errors';
import type { PaginatedProjects, ProjectSummary } from '@/lib/project-types';
import { ProjectCard } from './ProjectCard';
import {
  Alert,
  Button,
  ConfirmDialog,
  Input,
  Skeleton,
  useToast,
} from '@/components/ui';

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
  const toast = useToast();

  const [companyProfile, setCompanyProfile] = useState<CompanyProfileData | null>(null);
  const [apiProjects, setApiProjects] = useState<ProjectSummary[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 12, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [apiLoading, setApiLoading] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [error, setError] = useState('');
  const [showAccountConfirm, setShowAccountConfirm] = useState(false);
  const [isAccountDeleting, setIsAccountDeleting] = useState(false);
  const [form, setForm] = useState({ name: 'Rénovation salon', room_name: 'Salon' });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [clientsCount, setClientsCount] = useState<number | null>(null);
  const [quotesCount, setQuotesCount] = useState<number | null>(null);
  const [quickStarting, setQuickStarting] = useState(false);

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
    setError('');
    setIsAccountDeleting(true);
    try {
      await deleteAccount();
      router.push('/login');
    } catch (err: unknown) {
      setShowAccountConfirm(false);
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
      setError(getErrorMessage(err, 'Impossible de créer le projet'));
    }
  };

  /**
   * Entrée du parcours « devis-minute » (PRO-5).
   *
   * Chez le client, nommer le chantier avant de pouvoir photographier est une
   * étape sans valeur : le nom se corrige à froid, la photo non — le client
   * attend. On crée donc le chantier avec un libellé daté et on part droit sur
   * l'appareil photo. Le composer « Nouveau chantier » reste là pour qui veut
   * nommer d'emblée.
   */
  const handleQuickQuote = async () => {
    setError('');
    setQuickStarting(true);
    try {
      const stamp = new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date());
      const created = await apiPost<{ id: string }>('/projects', {
        name: `Devis du ${stamp}`,
        room_name: 'Pièce 1',
      });
      router.push(`/projects/${created.id}/photos`);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Impossible de démarrer le devis'));
      setQuickStarting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setError('');
    try {
      await apiDelete(`/projects/${deleteTarget.id}`);
      setDeleteTarget(null);
      toast.success('Projet supprimé avec succès.');
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
                  className="rounded-full bg-[var(--accent)]/10 px-3 py-0.5 text-xs font-medium text-[var(--accent-strong)]"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-sm text-stone-500">{appUser.email}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setIsComposerOpen((v) => !v)}>
            {isComposerOpen ? 'Fermer' : 'Nouveau chantier'}
          </Button>
          <Button variant="secondary" onClick={() => router.push('/quotes')}>
            Mes devis
          </Button>
          <Button variant="secondary" onClick={() => router.push('/invoices')}>
            Mes factures
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push('/settings/company')}
          >
            Profil entreprise
          </Button>
          <Button variant="secondary" onClick={handleLogout}>
            Déconnexion
          </Button>
          <button
            type="button"
            onClick={() => setShowAccountConfirm(true)}
            className="inline-flex min-h-11 items-center rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Supprimer mon compte
          </button>
        </div>
      </div>

      {/* Devis-minute — le pitch n°1 du tier Contractor (stratégie §7.2) */}
      <button
        type="button"
        onClick={handleQuickQuote}
        disabled={quickStarting}
        className="mt-6 flex w-full min-h-16 items-center gap-4 rounded-[2rem] bg-[var(--accent)] px-6 py-5 text-left text-white shadow-[0_20px_50px_rgba(29,107,87,0.25)] transition-colors hover:bg-[var(--accent-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-70"
      >
        <svg
          className="h-7 w-7 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.7}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
          />
        </svg>
        <span className="min-w-0">
          <span className="block text-base font-semibold">
            {quickStarting ? 'Démarrage...' : 'Devis-minute'}
          </span>
          <span className="block text-sm text-white/80">
            Photo de la pièce → devis PDF envoyé au client
          </span>
        </span>
      </button>

      {/* Subscription Card */}
      <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 px-6 py-4 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-stone-900">
              Plan Contractor
              {subscription?.cancel_at_period_end && (
                <span className="ml-2 text-xs font-normal text-amber-600">
                  (annulation prévue)
                </span>
              )}
            </p>
            {nextBilling && (
              <p className="mt-1 text-xs text-stone-500">
                {subscription?.cancel_at_period_end
                  ? `Actif jusqu'àu ${nextBilling}`
                  : `Prochain prélèvement le ${nextBilling}`}
              </p>
            )}
          </div>
          <Button variant="secondary" onClick={openPortal} className="shrink-0">
            Gérer mon abonnement
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
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
        <Link
          href="/quotes"
          className="rounded-2xl border border-stone-200 bg-white/85 p-4 transition-colors hover:border-stone-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Devis
          </p>
          <p className="mt-1 text-2xl font-bold text-stone-900">
            {quotesCount ?? '-'}
          </p>
        </Link>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="error" className="mt-6">
          {error}
        </Alert>
      )}

      {/* Create Project Form */}
      {isComposerOpen && (
        <section className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          <h2 className="text-xl font-semibold text-stone-950">
            Nouveau chantier
          </h2>
          <form onSubmit={handleCreateProject} className="mt-6 grid gap-4 md:grid-cols-2">
            <Input
              label="Nom du chantier"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              label="Pièce concernée"
              required
              value={form.room_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, room_name: e.target.value }))
              }
            />
            <div className="md:col-span-2">
              <Button type="submit" size="lg">
                Créer le chantier
              </Button>
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
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-48 rounded-[2rem]" />
            <Skeleton className="h-48 rounded-[2rem]" />
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
              Créez votre premier chantier pour commencer.
            </p>
            <Button
              size="lg"
              className="mt-6"
              onClick={() => setIsComposerOpen(true)}
            >
              Créer mon premier chantier
            </Button>
          </div>
        )}
      </section>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            &larr; Précédent
          </Button>
          <span className="text-sm text-stone-600">
            Page {meta.page} / {meta.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant &rarr;
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Supprimer le projet"
        message={
          <>
            Vous allez supprimer le projet{' '}
            <span className="font-semibold text-stone-800">
              {deleteTarget?.name}
            </span>
            . Il sera conservé pendant 30 jours avant suppression définitive.
          </>
        }
        confirmLabel="Confirmer la suppression"
        destructive
        busy={isDeleting}
        onConfirm={handleDeleteProject}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Account Deletion Dialog */}
      <ConfirmDialog
        open={showAccountConfirm}
        title="Supprimer mon compte"
        message="Votre compte et toutes vos données seront supprimés définitivement. Cette action est irréversible."
        confirmLabel="Supprimer définitivement"
        destructive
        busy={isAccountDeleting}
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowAccountConfirm(false)}
      />
    </main>
  );
}
