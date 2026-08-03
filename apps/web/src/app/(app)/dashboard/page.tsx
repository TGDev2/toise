'use client';

import { GuestPromptModal } from '@/components/auth/GuestPromptModal';
import { ContractorDashboard } from '@/components/dashboard/ContractorDashboard';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { Alert, Button, ConfirmDialog, Input, Skeleton, useToast } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureGates } from '@/contexts/FeatureGateContext';
import { useSubscription } from '@/hooks/useSubscription';
import { apiDelete, apiGet, apiPost, ApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type { PaginatedProjects, ProjectSummary } from '@/lib/project-types';
import { WORK_TYPE_LABELS } from '@/lib/project-types';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type WorkType = 'painting' | 'tiling' | 'flooring' | 'partition';

interface ProjectDraft {
  id: string;
  name: string;
  room_name: string;
  work_type: WorkType;
  length_m?: number;
  width_m?: number;
  height_m?: number;
  updated_at: string;
}

const STORAGE_KEY = 'chiffreo_local_projects';

function readStoredProjects(): ProjectDraft[] {
  if (typeof window === 'undefined') return [];
  const rawProjects = localStorage.getItem(STORAGE_KEY);
  if (!rawProjects) return [];
  try {
    const parsedProjects = JSON.parse(rawProjects);
    return Array.isArray(parsedProjects) ? parsedProjects : [];
  } catch {
    return [];
  }
}

function persistProjects(projects: ProjectDraft[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function formatProjectDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function DashboardPage() {
  const { appUser, isGuest, isLoading, logout, deleteAccount } = useAuth();
  const { showPaywall } = useFeatureGates();
  const { subscription, openCheckout, openPortal } = useSubscription();
  const router = useRouter();

  // Guest state (localStorage)
  const [guestProjects, setGuestProjects] = useState<ProjectDraft[]>([]);

  // Authenticated state (API)
  const [apiProjects, setApiProjects] = useState<ProjectSummary[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 12, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [apiLoading, setApiLoading] = useState(false);

  // Shared state
  const toast = useToast();
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [error, setError] = useState('');
  const [showAccountConfirm, setShowAccountConfirm] = useState(false);
  const [isAccountDeleting, setIsAccountDeleting] = useState(false);
  const [form, setForm] = useState({ name: 'Rénovation salon', room_name: 'Salon' });

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isLoading && !appUser && !isGuest) {
      router.push('/login');
    }
  }, [appUser, isGuest, isLoading, router]);

  // Load guest projects
  useEffect(() => {
    if (isGuest) {
      setGuestProjects(readStoredProjects());
    }
  }, [isGuest]);

  // Fetch API projects for authenticated users
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
    if (appUser) {
      fetchProjects(page);
    }
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

  const handleCreateDraft = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      if (appUser) {
        const created = await apiPost<{ id: string }>('/projects', {
          name: form.name.trim(),
          room_name: form.room_name.trim(),
        });
        router.push(`/projects/${created.id}/photos`);
        return;
      }

      const project: ProjectDraft = {
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}`,
        name: form.name.trim(),
        room_name: form.room_name.trim(),
        work_type: 'painting' as WorkType,
        updated_at: new Date().toISOString(),
      };

      const nextProjects = [project, ...guestProjects];
      persistProjects(nextProjects);
      setGuestProjects(nextProjects);
      router.push(`/projects/${project.id}/dimensions`);
    } catch (err: unknown) {
      // Un invité qui atteint son quota (1 projet, E2-1) n'a rien à acheter :
      // il lui manque un compte, pas un abonnement. Lui servir le paywall Pro
      // lui demanderait de payer ce qui est gratuit.
      if (err instanceof ApiError && err.code === 'ACCOUNT_REQUIRED') {
        setShowGuestPrompt(true);
        return;
      }
      if (err instanceof ApiError && err.code === 'PROJECT_LIMIT_REACHED') {
        showPaywall('unlimited_projects');
        return;
      }
      setError(getErrorMessage(err, 'Impossible de créer le projet'));
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

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Skeleton className="h-40 rounded-[2rem]" />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-[2rem]" />
          <Skeleton className="h-48 rounded-[2rem]" />
        </div>
      </main>
    );
  }

  if (appUser?.subscription_tier?.startsWith('contractor')) {
    return <ContractorDashboard />;
  }

  const hasProjects = appUser ? apiProjects.length > 0 : guestProjects.length > 0;
  const showPagination = appUser && meta.totalPages > 1;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-[2rem] border border-stone-200 bg-[var(--surface)] p-6 shadow-[0_25px_80px_rgba(67,39,15,0.10)] lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">
            Mes projets
          </h1>
          {isGuest && (
            <p className="mt-3 text-sm text-amber-700">
              Mode invité — vous pouvez préparer un projet, puis créer votre
              compte au moment de la sauvegarde.
            </p>
          )}
          {appUser && (
            <p className="mt-3 text-sm text-stone-500">{appUser.email}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setIsComposerOpen((v) => !v)}>
            {isComposerOpen ? 'Fermer le formulaire' : 'Créer un projet'}
          </Button>
          {appUser && (
            <Button variant="secondary" onClick={() => router.push('/referrals')}>
              Parrainage
            </Button>
          )}
          {appUser && (
            <Button variant="secondary" onClick={() => router.push('/logbook')}>
              Carnet du logement
            </Button>
          )}
          <Button variant="secondary" onClick={handleLogout}>
            {isGuest ? 'Quitter le mode invité' : 'Déconnexion'}
          </Button>
          {appUser && (
            <button
              type="button"
              onClick={() => setShowAccountConfirm(true)}
              className="rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-700 hover:-translate-y-0.5 hover:bg-red-50"
            >
              Supprimer mon compte
            </button>
          )}
        </div>
      </div>

      {/* Subscription Card */}
      {appUser && (
        <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white/85 px-6 py-4 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
          {(() => {
            const tier = appUser.subscription_tier;
            const status = subscription?.status;

            if (status === 'past_due') {
              return (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-red-700">
                      Problème de paiement
                    </p>
                    <p className="mt-1 text-xs text-red-600">
                      Mettez à jour votre moyen de paiement pour conserver vos
                      fonctionnalités Pro.
                    </p>
                  </div>
                  <Button variant="danger" onClick={openPortal} className="shrink-0">
                    Mettre à jour
                  </Button>
                </div>
              );
            }

            if (status === 'trialing') {
              const trialEnd = subscription?.trial_end
                ? new Intl.DateTimeFormat('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(subscription.trial_end))
                : null;
              return (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">
                      Essai Pro
                    </p>
                    {trialEnd && (
                      <p className="mt-1 text-xs text-stone-500">
                        Fin de l&apos;essai le {trialEnd}
                      </p>
                    )}
                  </div>
                  <Button variant="secondary" onClick={openPortal} className="shrink-0">
                    Gérer mon abonnement
                  </Button>
                </div>
              );
            }

            if (tier?.startsWith('contractor') && (status === 'active' || status === 'trialing')) {
              return (
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
                  </div>
                  <Button variant="secondary" onClick={openPortal} className="shrink-0">
                    Gérer mon abonnement
                  </Button>
                </div>
              );
            }

            if (tier === 'pro' && status === 'active') {
              const nextBilling = subscription?.current_period_end
                ? new Intl.DateTimeFormat('fr-FR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  }).format(new Date(subscription.current_period_end))
                : null;
              return (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">
                      Plan Pro
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
              );
            }

            // Free tier
            return (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    Plan gratuit
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    Passez à Pro pour débloquer toutes les fonctionnalités.
                  </p>
                </div>
                <Button onClick={() => openCheckout()} className="shrink-0">
                  Passer à Pro
                </Button>
              </div>
            );
          })()}
        </div>
      )}

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
            Préparer un brouillon de projet
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Le visiteur peut avancer sans compte jusqu&apos;à l&apos;étape de
            sauvegarde.
          </p>
          <form onSubmit={handleCreateDraft} className="mt-6 grid gap-4 md:grid-cols-2">
            <Input
              label="Nom du projet"
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
                Continuer vers les dimensions
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* Loading state for API projects */}
      {appUser && apiLoading && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-[2rem]" />
          <Skeleton className="h-48 rounded-[2rem]" />
        </div>
      )}

      {/* Authenticated user: API projects */}
      {appUser && !apiLoading && (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {apiProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={openDeleteDialog}
            />
          ))}
        </section>
      )}

      {/* Guest user: localStorage projects */}
      {isGuest && (
        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {guestProjects.map((project) => (
            <article
              key={project.id}
              className="rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                    {WORK_TYPE_LABELS[project.work_type] ?? 'Projet'}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-stone-950">
                    {project.name}
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">
                    Pièce : {project.room_name}
                  </p>
                </div>
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
                  {formatProjectDate(project.updated_at)}
                </span>
              </div>

              {project.length_m && project.width_m && project.height_m ? (
                <div className="mt-5 grid grid-cols-3 gap-3 text-sm text-stone-700">
                  <div className="rounded-2xl bg-stone-50 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                      Longueur
                    </p>
                    <p className="mt-2 font-semibold">{project.length_m} m</p>
                  </div>
                  <div className="rounded-2xl bg-stone-50 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                      Largeur
                    </p>
                    <p className="mt-2 font-semibold">{project.width_m} m</p>
                  </div>
                  <div className="rounded-2xl bg-stone-50 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                      Hauteur
                    </p>
                    <p className="mt-2 font-semibold">{project.height_m} m</p>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  onClick={() => router.push(`/projects/${project.id}/dimensions`)}
                >
                  {project.length_m ? 'Modifier les dimensions' : 'Définir les dimensions'}
                </Button>
                <Button variant="secondary" onClick={() => setShowGuestPrompt(true)}>
                  Sauvegarder dans mon compte
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Pagination */}
      {showPagination && (
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

      {/* Empty State */}
      {!hasProjects && !isComposerOpen && !apiLoading && (
        <section className="mt-6 rounded-[2rem] border-2 border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <h2 className="text-2xl font-semibold text-stone-950">
            Aucun projet pour le moment
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            Créez un premier brouillon : dimensions, travaux, estimation et
            liste d&apos;achat en quelques minutes.
          </p>
          <Button
            size="lg"
            className="mt-6"
            onClick={() => setIsComposerOpen(true)}
          >
            Créer mon premier projet
          </Button>
        </section>
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

      {/* Guest Prompt Modal */}
      <GuestPromptModal
        isOpen={showGuestPrompt}
        onClose={() => setShowGuestPrompt(false)}
        onSuccess={() => {
          setShowGuestPrompt(false);
          toast.success(
            "Compte créé. Si vous avez choisi l'inscription par email, vérifiez votre boîte de réception.",
          );
        }}
      />
    </main>
  );
}
