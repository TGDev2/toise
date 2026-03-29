'use client';

import { GuestPromptModal } from '@/components/auth/GuestPromptModal';
import { DeleteConfirmDialog } from '@/components/dashboard/DeleteConfirmDialog';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { useAuth } from '@/contexts/AuthContext';
import { apiDelete, apiGet, apiPost } from '@/lib/api';
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

const STORAGE_KEY = 'estimate_local_projects';

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
  const router = useRouter();

  // Guest state (localStorage)
  const [guestProjects, setGuestProjects] = useState<ProjectDraft[]>([]);

  // Authenticated state (API)
  const [apiProjects, setApiProjects] = useState<ProjectSummary[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 12, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [apiLoading, setApiLoading] = useState(false);

  // Shared state
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [isAccountDeleting, setIsAccountDeleting] = useState(false);
  const [form, setForm] = useState({ name: 'Renovation salon', room_name: 'Salon' });

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

  const handleCreateDraft = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      if (appUser) {
        const created = await apiPost<{ id: string }>('/projects', {
          name: form.name.trim(),
          room_name: form.room_name.trim(),
        });
        router.push(`/projects/${created.id}/dimensions`);
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

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Chargement...</p>
      </main>
    );
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
              Mode invite - vous pouvez preparer un projet, puis creer votre
              compte au moment de la sauvegarde.
            </p>
          )}
          {appUser && (
            <p className="mt-3 text-sm text-stone-500">{appUser.email}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsComposerOpen((v) => !v)}
            className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
          >
            {isComposerOpen ? 'Fermer le formulaire' : 'Creer un projet'}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
          >
            {isGuest ? 'Quitter le mode invite' : 'Deconnexion'}
          </button>
          {appUser && (
            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={isAccountDeleting}
              className="rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-700 hover:-translate-y-0.5 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAccountDeleting ? 'Suppression...' : 'Supprimer mon compte'}
            </button>
          )}
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
            Preparer un brouillon de projet
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Le visiteur peut avancer sans compte jusqu&apos;a l&apos;etape de
            sauvegarde.
          </p>
          <form onSubmit={handleCreateDraft} className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-stone-700">
                Nom du projet
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
                Continuer vers les dimensions
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Loading state for API projects */}
      {appUser && apiLoading && (
        <div className="mt-6 flex justify-center">
          <p className="text-sm text-stone-500">Chargement des projets...</p>
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
                    Piece : {project.room_name}
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
                <button
                  type="button"
                  onClick={() => router.push(`/projects/${project.id}/dimensions`)}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
                >
                  {project.length_m ? 'Modifier les dimensions' : 'Definir les dimensions'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGuestPrompt(true)}
                  className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:-translate-y-0.5 hover:bg-white"
                >
                  Sauvegarder dans mon compte
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Pagination */}
      {showPagination && (
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

      {/* Empty State */}
      {!hasProjects && !isComposerOpen && !apiLoading && (
        <section className="mt-6 rounded-[2rem] border-2 border-dashed border-stone-300 bg-white/60 p-12 text-center">
          <h2 className="text-2xl font-semibold text-stone-950">
            Aucun projet pour le moment
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            Creez un premier brouillon pour couvrir le parcours visiteur,
            sauvegarde et conversion vers un compte.
          </p>
          <button
            type="button"
            onClick={() => setIsComposerOpen(true)}
            className="mt-6 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-[var(--accent-strong)]"
          >
            Creer mon premier projet
          </button>
        </section>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={deleteTarget !== null}
        projectName={deleteTarget?.name ?? ''}
        onConfirm={handleDeleteProject}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />

      {/* Guest Prompt Modal */}
      <GuestPromptModal
        isOpen={showGuestPrompt}
        onClose={() => setShowGuestPrompt(false)}
        onSuccess={() => {
          setShowGuestPrompt(false);
          setFeedback(
            "Compte cree. Si vous avez choisi l'inscription par email, verifiez votre boite de reception.",
          );
        }}
      />
    </main>
  );
}
